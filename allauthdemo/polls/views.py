import urllib
import urllib2
import json
import logging
import base64

from django.contrib import messages
from django.http import HttpResponseRedirect, HttpResponse, Http404
from django.http.response import HttpResponseNotAllowed
from django.core.urlresolvers import reverse
from django.shortcuts import get_object_or_404, render
from django.views import generic
from django.conf import settings

from .forms import PollForm, OptionFormset, VoteForm, EventSetupForm, EventEditForm
from .models import Event, Poll, Ballot, EncBallot,  EncryptedVote, TrusteeKey, PartialBallotDecryption, CombinedBallot, VoteFragment
from allauthdemo.auth.models import DemoUser

from .tasks import email_trustees_prep, update_EID, generate_combpk, event_ended, create_ballots
from .tasks import create_ballots_for_poll, email_voters_vote_url, combine_decryptions_and_tally, combine_encrypted_votes
from .tasks import email_voting_success, email_organisers_next_steps

from .utils.EventModelAdaptor import EventModelAdaptor


class EventListView(generic.ListView):

    model = Event

    def get_context_data(self, **kwargs):
        context = super(EventListView, self).get_context_data(**kwargs)
        return context


class EventDetailView(generic.DetailView):
    template_name = "polls/event_detail_details.html"
    model = Event

    def get_context_data(self, **kwargs):
        context = super(EventDetailView, self).get_context_data(**kwargs)
        context['is_organiser'] = (not self.request.user.is_anonymous()) and (self.object.users_organisers.filter(email=self.request.user.email).exists())
        context['decrypted'] = self.object.status() == "Decrypted"

        # Get the results for all polls
        polls = self.object.polls.all()

        results = list()
        for poll in polls:
            result_json = poll.result_json

            if result_json is None:
                continue

            if result_json[len(result_json)-1] == ',':
                result_json = result_json[0:len(result_json)-1]

            result_json = json.loads(result_json)
            results.append(result_json)

        context['event_results'] = results

        return context


class EventDetailPollsView(EventDetailView):
    template_name = "polls/event_detail_polls.html"


class EventDetailEntitiesView(EventDetailView):
    template_name = "polls/event_detail_entities.html"


class EventDetailAdvancedView(EventDetailView):
    template_name = "polls/event_detail_advanced.html"


class PollDetailView(generic.View):
    model = Poll

    def get_context_data(self, **kwargs):
        context = super(PollDetailView, self).get_context_data(**kwargs)
        context['form'] = VoteForm(instance=self.object)
        context['poll_count'] = self.object.event.polls.all().count()
        return context


class EventDetailResultsView(EventDetailView):
    template_name = "polls/event_results.html"


def util_get_poll_by_event_index(event, poll_id):
    return event.polls.get(uuid=poll_id)


def edit_poll(request, event_id, poll_id):
    event = get_object_or_404(Event, pk=event_id)
    poll = util_get_poll_by_event_index(event, poll_id)

    if (poll == None):
        raise Http404("Poll does not exist")

    if request.method == 'GET':
        form = PollForm(instance=poll, prefix="main")
        formset = OptionFormset(instance=poll, prefix="formset_options")
        return render(request, "polls/generic_form.html", {'form_title': "Edit Poll: " + poll.question_text, 'form': form, 'option_formset': formset})
    elif request.method == 'POST':
        form = PollForm(request.POST, instance=poll, prefix="main")

        if form.is_valid():
            form.save()

            formset = OptionFormset(request.POST, instance=poll, prefix="formset_options")

            if formset.is_valid():
                formset.save()
                return HttpResponseRedirect(reverse('polls:event-polls', args=[poll.event_id]))


def vote_audit(request):
    encrypted_ballot = get_object_or_404(EncBallot, handle=''+urllib.quote_plus(request.GET.get('handle', None)))

    return render(request, "polls/vote_audit.html",
                  {
                      "ballot": encrypted_ballot.ballot
                  })


def event_vote(request, event_id, poll_id):
    event = get_object_or_404(Event, pk=event_id)

    if not event.prepared:
        messages.add_message(request, messages.WARNING, "This Event isn\'t ready for voting yet.")
        return HttpResponseRedirect(reverse("user_home"))

    # Lookup the specified poll
    poll = event.polls.get(uuid=poll_id)

    if poll is None:
        messages.add_message(request, messages.ERROR, "There was an error loading the voting page.")
        return HttpResponseRedirect(reverse("user_home"))

    polls = event.polls.all()
    event_poll_count = len(polls)
    prev_poll_uuid, next_poll_uuid, poll_num = False, False, 0
    can_vote, cant_vote_reason, has_voted, voter_email = False, "", False, ""

    for i in range(event_poll_count):
        poll = polls[i]
        poll_uuid = str(poll.uuid)
        req_poll_uuid = str(poll_id)

        if poll_uuid == req_poll_uuid:
            poll_num = str(i+1)

            # If current voting request isn't for the last poll, then make sure we link to the next
            if i != event_poll_count - 1:
                # Only set the previous poll's uuid if we're not looking at the first poll
                if i != 0:
                    prev_poll_uuid = str(polls[i - 1].uuid)

                next_poll_uuid = str(polls[i + 1].uuid)
            else:
                if i != 0:
                    prev_poll_uuid = str(polls[i - 1].uuid)

            break

    access_key = request.GET.get('key', None)
    email_key = event.keys.filter(key=access_key)
    email_key_str = email_key[0].key

    if email_key.exists() and event.voters.filter(email=email_key[0].user.email).exists():
        # Passing this test means the user can vote
        voter_email = email_key[0].user.email
        can_vote = True

        # Check whether this is the first time a user is voting
        ballot = Ballot.objects.filter(voter=email_key[0].user, poll=poll)
        if ballot.exists() and ballot[0].cast:
            has_voted = True
    else:
        can_vote = False
        cant_vote_reason = "You don't have permission to access this page."

    if event.status() != "Active":
        can_vote = False
        cant_vote_reason = "The event either isn't ready for voting or it has expired and therefore you cannot vote."

    if request.method == "POST":
        ballot_str = request.POST.get('ballot')
        ballot_json = json.loads(ballot_str)
        selection = request.POST.get('selection')
        encrypted_votes_json = ballot_json['encryptedVotes']

        enc_ballot_json = request.POST.get('encBallot')
        handle_json = request.POST.get('handle')

        # Adds or replaces the encrypted un-submitted ballot to the database for the auditor app to pick up later
        if EncBallot.objects.filter(handle=handle_json).exists():
            b = EncBallot.objects.get(handle=handle_json)
            b.ballot = enc_ballot_json
            b.save()
        else:
            b = EncBallot(handle=handle_json, ballot=enc_ballot_json)
            b.save()

        # Before storing the encrypted votes, we need the voter's ballot
        ballot, created = Ballot.objects.get_or_create(voter=email_key[0].user, poll=poll)
        EncryptedVote.objects.filter(ballot=ballot).delete()

        for e_vote in encrypted_votes_json:
            # Will store the fragments of the encoding scheme that define the vote
            encrypted_vote = EncryptedVote.objects.create(ballot=ballot)
            fragments_json = e_vote['fragments']

            for fragment in fragments_json:
                VoteFragment.objects.create(encrypted_vote=encrypted_vote,
                                            cipher_text_c1=fragment['C1'],
                                            cipher_text_c2=fragment['C2'])

        ballot.cast = True
        ballot.selection = selection
        ballot.json_str = ballot_str
        ballot.save()

        voter = email_key[0].user
        combine_encrypted_votes.delay(voter, poll)
        email_voting_success.delay(voter, handle_json, event.title)

        if next_poll_uuid:
            return HttpResponseRedirect(reverse('polls:event-vote', kwargs={'event_id': event.uuid,
                                                                            'poll_id': next_poll_uuid})
                                        + "?key=" + email_key_str)

        return HttpResponse('Voted Successfully!')

    return render(request, "polls/event_vote.html",
        {
            "object": poll, "poll_num": poll_num, "event": event, "poll_count": event.polls.all().count(),
            "prev_uuid": prev_poll_uuid, "next_uuid": next_poll_uuid, "min_selection": poll.min_num_selections,
            "max_selection": poll.max_num_selections, "can_vote": can_vote, "cant_vote_reason": cant_vote_reason,
            "voter_email": voter_email, "has_voted": has_voted, "a_key": email_key_str
        })


def event_trustee_setup(request, event_id):
    # Obtain the event and the event preparation access key that's been supplied
    event = get_object_or_404(Event, pk=event_id)
    access_key = request.GET.get('key', None)

    # If the a_key is present, check it's valid and related to a trustee EmailUser instance for this event
    if access_key:
        email_key = event.keys.filter(key=access_key)
        if email_key.exists() and event.users_trustees.filter(email=email_key[0].user.email).exists():
            if TrusteeKey.objects.filter(event=event, user=email_key[0].user).exists():
                return render(request, "polls/event_setup.html", {"is_trustee": True,
                                                                  "can_submit": False,
                                                                  "access_denied_reason": "You have already submitted your public key for this event. Thank you!"
                                                                  })
            if request.method == "POST":
                form = EventSetupForm(request.POST)

                # If form data is valid, create a TrusteeKey object with the supplied public key
                if form.is_valid():
                    public_key = request.POST.get("public_key")
                    key = TrusteeKey.objects.get_or_create(event=event, user=email_key[0].user)[0]
                    key.key = public_key
                    key.save()

                    # When all trustees have supplied their public key, we can combine them to create a master key
                    # The event will now be ready to receive votes on the various polls that have been defined -
                    # voters therefore need to be informed
                    if event.trustee_keys.count() == event.users_trustees.count():
                        create_ballots.delay(event)
                        generate_combpk.delay(event)
                        email_voters_vote_url.delay(event.voters.all(), event)
                        email_organisers_next_steps.delay(event)

                    success_msg = 'You have successfully submitted your public key for this event!'
                    messages.add_message(request, messages.SUCCESS, success_msg)

                    return HttpResponseRedirect(reverse("user_home"))
            else:
                form = EventSetupForm()
                return render(request, "polls/event_setup.html", {"event": event,
                                                                  "form": form,
                                                                  "user_email": email_key[0].user.email,
                                                                  "is_trustee": True,
                                                                  "can_submit": True
                                                                  })

    else:
        return render(request, "polls/event_setup.html", {"is_trustee": False,
                                                          "can_submit": False,
                                                          "access_denied_reason": "You do not have permission to access this page."
                                                          })


def event_end(request, event_id):
    event = get_object_or_404(Event, pk=event_id)

    if not event.ended:
        event_ended.delay(event)

        # Mark the event as ended
        event.ended = True
        event.save()

    return HttpResponseRedirect(reverse('polls:view-event', args=[event_id]))


def event_trustee_decrypt(request, event_id):
    event = get_object_or_404(Event, pk=event_id)
    access_key = request.GET.get('key', None)

    if access_key:
        email_key = event.keys.filter(key=access_key)
        trustee = email_key[0].user

        if email_key.exists() and event.users_trustees.filter(email=trustee.email).exists():

            if PartialBallotDecryption.objects.filter(event=event, user=trustee).count() == event.total_num_opts():
                return render(request, "polls/event_decrypt.html", {"is_trustee": True,
                                                                    "can_submit": False,
                                                                    "access_denied_reason": "You have already submitted your partial decryptions for this event. Thank you!"
                                                                    })
            elif request.method == "GET":
                # Get the Trustee's original PK - used in the template for SK validation
                trustee_pk = TrusteeKey.objects.get(event=event, user=trustee).key

                # Gen a list of ciphers from the combined ballots for every opt of every poll
                polls = event.polls.all()
                poll_ciphers = []

                for poll in polls:
                    options = poll.options.all()

                    options_ciphers = []
                    for option in options:
                        combined_ballot = CombinedBallot.objects.filter(poll=poll, option=option).get()

                        cipher = {}
                        cipher['C1'] = combined_ballot.cipher_text_c1
                        cipher['C2'] = combined_ballot.cipher_text_c2
                        options_ciphers.append(cipher)

                    poll_ciphers.append(options_ciphers)

                return render(request,
                              "polls/event_decrypt.html",
                              {
                                  "event": event,
                                  "user_email": trustee.email,
                                  "trustee_pk": trustee_pk,
                                  "poll_ciphers": poll_ciphers,
                                  "is_trustee": True,
                                  "can_submit": True
                              })

            elif request.method == "POST":
                polls = event.polls.all()
                polls_count = len(polls)

                for i in range(polls_count):
                    options = polls[i].options.all()
                    options_count = len(options)

                    for j in range(options_count):
                        input_name = str("")
                        input_name = "poll-" + str(i) + "-cipher-" + str(j)

                        part_dec = request.POST.get(input_name)

                        PartialBallotDecryption.objects.create(event=event,
                                                               poll=polls[i],
                                                               option=options[j],
                                                               user=trustee,
                                                               text=part_dec)

                if event.all_part_decs_received():
                    # Decrypt the result once all partial decryptions have been received
                    # This will email all organisers once the results are ready
                    combine_decryptions_and_tally.delay(event)
                else:
                    # TODO: Get how many trustees have submitted a partial decryption
                    # TODO: Then get how many are left to submit their partial decryptions
                    # TODO: Then email the list of organisers to update them with this information
                    str("")

                messages.add_message(request, messages.SUCCESS, 'Your partial decryptions have been successfully submitted')
                return HttpResponseRedirect(reverse("user_home"))

    # Without an access key, the client does not have permission to access this page
    return render(request, "polls/event_decrypt.html", {"is_trustee": False,
                                                        "can_submit": False,
                                                        "access_denied_reason": "You don't have permission to access this page."
                                                        })


def manage_questions(request, event_id):

    event = get_object_or_404(Event, pk=event_id)

    if (request.user.is_anonymous()) or (not event.users_organisers.filter(email=request.user.email).exists()):
        messages.add_message(request, messages.WARNING, 'You do not have permission to access: ' + request.path)
        return HttpResponseRedirect(reverse("user_home"))

    poll = Poll()
    formset = OptionFormset(instance=poll, prefix="formset_organiser")

    if request.method == "POST":
        form = PollForm(request.POST, prefix="main")
        formset = OptionFormset(request.POST, prefix="formset_organiser") # incase form fails, we still want to retain formset data
        if form.is_valid():
            poll = form.save(commit=False)
            poll.event_id = event_id
            poll.save()
            formset = OptionFormset(request.POST, prefix="formset_organiser", instance=poll)
            if formset.is_valid():
                formset.save()
                create_ballots_for_poll.delay(poll)
                messages.add_message(request, messages.SUCCESS, 'Poll created successfully')
                return HttpResponseRedirect(reverse('polls:event-polls', args=[poll.event_id]))

        return render(request, "polls/create_poll.html", {"event": event, "question_form": form, "option_formset": formset})

    elif request.method == "GET":
        form = PollForm(prefix="main") #, instance=poll
        return render(request, "polls/create_poll.html", {"event": event, "question_form": form, "option_formset": formset})
    else:
        return HttpResponseNotAllowed()


def render_invalid(request, events, demo_users, invalid_fields):
    return render(request,
                  "polls/create_event.html",
                  {
                      "G_R_SITE_KEY": settings.RECAPTCHA_PUBLIC_KEY,
                      "user_email": request.user.email,
                      "events": events,
                      "demo_users": demo_users,
                      "invalid_fields": invalid_fields
                  })


def create_event(request):
    # Obtain context data for the rendering of the html template and validation
    events = Event.objects.all()
    demo_users = DemoUser.objects.all()

    if request.method == "POST":
        '''Perform Google reCAPTCHA validation'''
        recaptcha_response = request.POST.get('g-recaptcha-response')
        url = 'https://www.google.com/recaptcha/api/siteverify'
        values = {
            'secret': settings.RECAPTCHA_PRIVATE_KEY,
            'response': recaptcha_response
        }
        data = urllib.urlencode(values)
        req = urllib2.Request(url, data)
        response = urllib2.urlopen(req)
        result = json.load(response)

        '''Perform form data validation'''
        adaptor = EventModelAdaptor(request.POST, request.user)
        form_data_valid = adaptor.isFormDataValid(events, demo_users)

        '''Process form data based on above results'''
        if result['success']:
            if form_data_valid:
                # Create the new event using the form data
                adaptor.extractData()
                new_event = adaptor.updateModel()

                # Update the EID to include the GP in its EID
                update_EID.delay(new_event)

                # Send an email to all trustees for event preparation
                trustees = new_event.users_trustees.all()
                email_trustees_prep.delay(trustees, new_event)

                adaptor.clear_data()

                return HttpResponseRedirect(reverse('polls:index'))
            else:
                invalid_fields = adaptor.getInvalidFormFields()
                adaptor.clear_data()
                return render_invalid(request, events, demo_users, invalid_fields)
        else:
            invalid_fields = adaptor.getInvalidFormFields()
            invalid_fields['recaptcha'] = {'error': 'The reCAPTCHA server validation failed, please try again.'}
            adaptor.clear_data()
            return render_invalid(request, events, demo_users, invalid_fields)

    elif request.method == "GET":
        # Render the template
        return render(request,
                      "polls/create_event.html",
                      {
                          "G_R_SITE_KEY": settings.RECAPTCHA_PUBLIC_KEY,
                          "user_email": request.user.email,
                          "events": events,
                          "demo_users": demo_users
                      })
    else:
        return HttpResponseNotAllowed()


def edit_event(request, event_id):
    event = get_object_or_404(Event, pk=event_id)
    if request.method == "GET":
        form = EventEditForm(instance=event, prefix="main")
        '''
        organiser_initial_data = [{'email': request.user.email}]
        trustee_initial_data = []
        for user in event.users_organisers.exclude(email=request.user.email):
            organiser_initial_data.append({'email': user.email})
        organiser_formset = OrganiserFormSet(prefix="formset_organiser", initial=organiser_initial_data)
        for trustee in event.users_trustees.all():
            trustee_initial_data.append({'email': trustee.email})
        trustee_formset = TrusteeFormSet(prefix="formset_trustee", initial=trustee_initial_data)
        '''
    elif request.method == "POST":
        form = EventEditForm(request.POST, instance=event, prefix="main")
        #trustee_formset = TrusteeFormSet(request.POST, prefix="formset_trustee")
        #organiser_formset = OrganiserFormSet(request.POST, prefix="formset_organiser") # incase form fails, we still want to retain formset data
        if form.is_valid():
            form.save()
            '''
            if organiser_formset.is_valid():
                event.users_organisers.clear()
                for oform in organiser_formset:
                    if (oform.cleaned_data.get('email')):
                        event.users_organisers.add(DemoUser.objects.get(email=oform.cleaned_data['email']))
                event.users_organisers.add(request.user) # always add editor/creator
                if trustee_formset.is_valid():
                    event.users_trustees.clear()
                    for tform in trustee_formset:
                        if (tform.cleaned_data.get('email')):
                            event.users_trustees.add(EmailUser.objects.get_or_create(email=tform.cleaned_data['email'])[0])
            '''
            return HttpResponseRedirect(reverse('polls:view-event', kwargs={'pk': event.id}))
    return render(request, "polls/generic_form.html", {"form_title": "Edit Event: " + event.title, "form": form}) #"organiser_formset": organiser_formset, "trustee_formset": trustee_formset})
        #trustee_formset = TrusteeFormSet(request.POST, prefix="formset_trustee", instance=event)


def del_event(request, event_id):
    event = get_object_or_404(Event, pk=event_id)
    if request.method == "GET":
        return render(request, "polls/del_event.html", {"event_title": event.title, "event_id": event.uuid})
    elif request.method == "POST":
        event.delete()
        return HttpResponseRedirect(reverse('polls:index'))