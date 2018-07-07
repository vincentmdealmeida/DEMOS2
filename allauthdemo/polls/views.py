import urllib
import urllib2
import json

from django.contrib import messages
from django.http import HttpResponseRedirect, HttpResponse, Http404
from django.http.response import HttpResponseNotAllowed
from django.core.urlresolvers import reverse
from django.shortcuts import get_object_or_404, render
from django.views import generic
from django.conf import settings

from .forms import PollForm, OptionFormset, VoteForm, EventSetupForm, EventEditForm
from .models import Event, Poll, Ballot, EncryptedVote, TrusteeKey, TrusteeSK
from allauthdemo.auth.models import DemoUser

from .tasks import email_trustees_prep, update_EID, generate_combpk, event_ended, create_ballots, create_ballots_for_poll, email_voters_vote_url, gen_event_sk_and_dec

from .utils.EventModelAdaptor import EventModelAdaptor


class EventListView(generic.ListView):

    model = Event

    def get_context_data(self, **kwargs):
        context = super(EventListView, self).get_context_data(**kwargs)
        #context['now'] = timezone.now()
        return context


class EventDetailView(generic.DetailView):
    template_name="polls/event_detail_details.html"
    model = Event

    def get_context_data(self, **kwargs):
        context = super(EventDetailView, self).get_context_data(**kwargs)
        context['is_organiser'] = ((not self.request.user.is_anonymous()) and (self.object.users_organisers.filter(email=self.request.user.email).exists()))
        context['decrypted'] = self.object.status() == "Decrypted"

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


def util_get_poll_by_event_index(event, poll_num):
    try:
        poll_num = int(poll_num)
        if ((poll_num < 1) or (poll_num > event.polls.all().count())):
            return None
        poll = event.polls.filter().order_by('id')[poll_num-1] # index field eventually
    except ValueError:
        return None
    return poll


def edit_poll(request, event_id, poll_num):
    event = get_object_or_404(Event, pk=event_id)
    poll = util_get_poll_by_event_index(event, poll_num)

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


def event_vote(request, event_id, poll_num):
    event = get_object_or_404(Event, pk=event_id)

    if not event.prepared:
        messages.add_message(request, messages.WARNING, "This Event isn\'t ready for voting yet.")
        return HttpResponseRedirect(reverse("user_home"))

    event_poll_count = event.polls.all().count()
    prev_poll_index, next_poll_index = False, False
    can_vote, has_voted, voter_email = False, False, ""
    poll = util_get_poll_by_event_index(event, poll_num)

    if poll is None:
        messages.add_message(request, messages.ERROR, "There was an error loading the voting page.")
        return HttpResponseRedirect(reverse("user_home"))

    poll_num = int(poll_num) # now known to be safe as it succeeded in the util function

    if poll_num > 1:
        prev_poll_index = (poll_num - 1)
    if poll_num < event_poll_count:
        next_poll_index = (poll_num + 1)

    access_key = request.GET.get('key', None)
    email_key = event.keys.filter(key=access_key)

    ballot = None
    if email_key.exists() and event.voters.filter(email=email_key[0].user.email).exists():
        # Passing this test means the user can vote
        voter_email = email_key[0].user.email
        can_vote = True

        # Check whether this is the first time a user is voting
        ballot = Ballot.objects.filter(voter=email_key[0].user, poll=poll)
        if ballot.exists() and ballot[0].cast:
            has_voted = True
    else:
        messages.add_message(request, messages.ERROR, "You don\'t have permission to vote in this event.")
        return HttpResponseRedirect(reverse("user_home"))

    if request.method == "POST":
        if ballot is None:
            ballot = Ballot.objects.get_or_create(voter=email_key[0].user, poll=poll)

        # Will store the fragments of the encoding scheme that define the vote
        encrypted_vote = EncryptedVote.objects.get_or_create(ballot=ballot[0])[0]

        # Clear any existing fragments - a voter changing their vote
        encrypted_vote.fragment.all().delete()

        # Add in the new ciphers
        fragment_count = int(request.POST['vote_frag_count'])
        for i in range(fragment_count):
            i_str = str(i)

            cipher_c1 = request.POST['cipher_c1_frag_' + i_str]
            cipher_c2 = request.POST['cipher_c2_frag_' + i_str]

            encrypted_vote.fragment.create(encrypted_vote=encrypted_vote,
                                           cipher_text_c1=cipher_c1,
                                           cipher_text_c2=cipher_c2)

        ballot[0].cast = True
        ballot[0].save()

        if next_poll_index:
            return HttpResponseRedirect(reverse('polls:event-vote', kwargs={'event_id': event.id, 'poll_num': next_poll_index }) + "?key=" + email_key[0].key)
        else:
            # The user has finished voting in the event
            success_msg = 'You have successfully cast your vote(s)!'
            messages.add_message(request, messages.SUCCESS, success_msg)

            return HttpResponseRedirect(reverse("user_home"))

    return render(request, "polls/event_vote.html",
        {
            "object": poll, "poll_num": poll_num, "event": event, "poll_count": event.polls.all().count(),
            "prev_index": prev_poll_index, "next_index": next_poll_index, "min_selection": poll.min_num_selections,
            "max_selection": poll.max_num_selections, "can_vote": can_vote, "voter_email": voter_email,
            "has_voted": has_voted
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
                messages.add_message(request, messages.WARNING, 'You have already submitted your key for this event')
                return HttpResponseRedirect(reverse("user_home"))
            if request.method == "POST":
                form = EventSetupForm(request.POST)

                # If form data is valid, create a TrusteeKey object with the supplied public key
                if form.is_valid():
                    public_key = request.POST["public_key"]
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

                    success_msg = 'You have successfully submitted your public key for this event!'
                    messages.add_message(request, messages.SUCCESS, success_msg)

                    return HttpResponseRedirect(reverse("user_home"))
            else:
                form = EventSetupForm()
                return render(request, "polls/event_setup.html", {"event": event, "form": form, "user_email": email_key[0].user.email})

    #if no key or is invalid?
    messages.add_message(request, messages.WARNING, 'You do not have permission to access: ' + request.path)
    return HttpResponseRedirect(reverse("user_home"))


def event_end(request, event_id):
    event = get_object_or_404(Event, pk=event_id)

    if not event.ended:
        event_ended.delay(event)

        # Mark the event as ended
        event.ended = True
        event.save()

    return HttpResponseRedirect(reverse('polls:view-event', args=[event_id]))


# Returns a JSONed version of the results
def results(request, event_id):
    event = get_object_or_404(Event, pk=event_id)
    polls = event.polls.all()

    results = ""
    results += "{\"polls\":["
    for poll in polls:
        results += poll.enc

    results += "]}"

    return HttpResponse(results)


def event_trustee_decrypt(request, event_id):
    event = get_object_or_404(Event, pk=event_id)
    access_key = request.GET.get('key', None)

    if access_key:
        email_key = event.keys.filter(key=access_key)

        if email_key.exists() and event.users_trustees.filter(email=email_key[0].user.email).exists():
            if TrusteeSK.objects.filter(event=event, trustee=email_key[0].user).exists():
                messages.add_message(request, messages.WARNING, 'You have already provided your decryption key for this event')
                return HttpResponseRedirect(reverse("user_home"))
            elif request.method == "GET":
                return render(request, "polls/event_decrypt.html", {"event": event, "user_email": email_key[0].user.email})
            elif request.method == "POST":
                sk = request.POST['secret-key']

                TrusteeSK.objects.create(event=event,
                                         trustee=email_key[0].user,
                                         key=sk)

                if event.trustee_sk.count() == event.users_trustees.count():
                    # Generate the event SK and decrypt the event to tally the results
                    gen_event_sk_and_dec.delay(event)

                messages.add_message(request, messages.SUCCESS, 'Your secret key has been successfully submitted')
                return HttpResponseRedirect(reverse("user_home"))

    # Without an access key, the client does not have permission to access this page
    messages.add_message(request, messages.WARNING, 'You do not have permission to decrypt this Event.')
    return HttpResponseRedirect(reverse("user_home"))


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
        return render(request, "polls/del_event.html", {"event_title": event.title, "event_id": event.id})
    elif request.method == "POST":
        event.delete()
        return HttpResponseRedirect(reverse('polls:index'))