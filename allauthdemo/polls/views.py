from io import StringIO
from django.contrib import messages
from django.http import HttpResponseRedirect, HttpResponse, Http404
from django.core.urlresolvers import reverse
from django.shortcuts import get_object_or_404, render, render_to_response
from django.utils import timezone
from django.views import generic
from django.conf import settings
from django.core import serializers

from .forms import EventForm, PollForm, OptionFormset, QuestionFormset, OrganiserFormSet, TrusteeFormSet, VoteForm, EventSetupForm, EventEditForm, DecryptionFormset, DecryptionFormSetHelper
from .models import Event, Poll, PollOption, EmailUser, Ballot, TrusteeKey, Decryption
from allauthdemo.auth.models import DemoUser

from .tasks import create_voters, create_ballots, generate_event_param, generate_combpk, generate_enc, tally_results
from .cpp_calls import param, addec, combpk, tally

from .utils.CreateNewEventModelAdaptor import CreateNewEventModelAdaptor

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
        #context['now'] = timezone.now()
        return context


class EventDetailPollsView(EventDetailView):
    template_name="polls/event_detail_polls.html"

class EventDetailOrganisersView(EventDetailView):
    template_name="polls/event_detail_organisers.html"

class EventDetailLaunchView(EventDetailView):
    template_name="polls/event_detail_launch.html"

class PollDetailView(generic.View):

    model = Poll

    def get_context_data(self, **kwargs):
        context = super(PollDetailView, self).get_context_data(**kwargs)
        #context['now'] = timezone.now()
        context['form'] = VoteForm(instance=self.object)
        context['poll_count'] = self.object.event.polls.all().count()
        return context

#my_value = self.kwargs.get('key', 'default_value')

def test_poll_detail(request, event_id, poll_num, key=None):
    context = {}
    context['form'] = VoteForm(instance=self.object)
    context['poll_count'] = self.object.event.polls.all().count()
    return render(request, "polls/event_setup.html", context)

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
    event_poll_count = event.polls.all().count()
    poll = util_get_poll_by_event_index(event, poll_num)

    if (poll == None):
        raise Http404("Poll does not exist")

    form = PollForm(instance=poll, prefix="main")
    formset = OptionFormset(instance=poll, prefix="formset_options")
    return render(request, "polls/generic_form.html", {'form_title': "Edit Poll: " + poll.question_text, 'form': form, 'option_formset': formset})

def view_poll(request, event_id, poll_num):
    #return HttpResponse(param("012345"))
    #return HttpResponse(combpk(param("012345"), "ABzqvL+pqTi+DNLLRcM62RwCoaZTaXVbOs3sk4fc0+Dc 0 AAaQd6S1x+bcgnkDp2ev5mTt34ICQdZIzP9GaqG4x5sy 0" "ABhQay9jI4pZvkAETNwfo8iwJ8eBMkjqplqAiu/FZxMy 0 ABPxj0jVj3rt0VW54iv4tV02gYtujnR41t5gf97asrPs 0 ABfoiW03bsYIUgfAThmjurmOViKy9L89vfkIavhQIblm 1 ABhQay9jI4pZvkAETNwfo8iwJ8eBMkjqplqAiu/FZxMy 0 ABPxj0jVj3rt0VW54iv4tV02gYtujnR41t5gf97asrPs 0 ABfoiW03bsYIUgfAThmjurmOViKy9L89vfkIavhQIblm 1 ABhQay9jI4pZvkAETNwfo8iwJ8eBMkjqplqAiu/FZxMy 0 ABPxj0jVj3rt0VW54iv4tV02gYtujnR41t5gf97asrPs 0 ABfoiW03bsYIUgfAThmjurmOViKy9L89vfkIavhQIblm 1"))
    #return HttpResponse(addec("ACMW70Yj3+mJ/FO+6VOSDGYPYHf7NoTXdpInbfzUqYpH 0 ABV4Mo496B0FW3AW/7gY6Fs+oz6BwfwilonMYeriUyV/ 0 AAg+bdGhs3sxSxAc/wcKdBNUy+el8A2b4yVYShNOb8uX 0 AAspJbn5V2AaY4CgLkzCkHwUWbC5nyxrBzw+o4Az8HVM 1 ABKI7o5Yhgi44XwpFnPpLnH0/czbXA8y5vM4ucV8vojo 1 AAwVrT9+dcQsqRZYoI7+QsJvWOgd7JaJpfI6envmC2jU 1 ABIZO0DK4OrdROD805of6iRk2RenonGYmo2qG2IB1sj/ 1 ACMUHQdjGN0wyCd2AgDHMk9u0TpnywNVtamHWopGho8L 0 ABNT5lbE4siC3QklQXRvTwSQPwtme91+UrIr9iXT3y84 1 ABib0mmQ9ZVCrErqFwDgoRp3jHPpjHGQR2vsMVlwM+vI 0 ABvf3cg1NSS8fn6EKJNnTomeoflcEY1WBxkPPKrBBFl+ 0 ACBUZAtolN4HNh+mw4jLZuHzD+/rYHKR5av16PUc6BJF 0", "2"))
    #return HttpResponse(tally("ACNQLLQlh+lNm1Dc+X+dEI0ECVLTkxRHjRnzX1OA+HtW 0 AAWOsUZK/G/cjhUee/gPAXop3Bc0CTVG3iDdQxD6+XqV 0", "ACNQLLQlh+lNm1Dc+X+dEI0ECVLTkxRHjRnzX1OA+HtW 0 0 2", "2"))
    event = get_object_or_404(Event, pk=event_id)
    if (not event.prepared):
        messages.add_message(request, messages.WARNING, "This Event isn\'t ready for voting yet.")
        return HttpResponseRedirect(reverse("user_home"))
    event_poll_count = event.polls.all().count()
    prev_poll_index, next_poll_index = False, False
    can_vote, has_voted, voter_email, vote_count = False, False, "", 0
    poll = util_get_poll_by_event_index(event, poll_num)

    if (poll == None):
        raise Http404("Poll does not exist")

    form = VoteForm(instance=poll)
    poll_num = int(poll_num) # now known to be safe as it suceeded in the util function

    if (poll_num > 1):
        prev_poll_index = (poll_num - 1)
    if (poll_num < event_poll_count):
        next_poll_index = (poll_num + 1)

    access_key = request.GET.get('key', None)
    email_key = event.keys.filter(key=access_key)
    vote_count = Ballot.objects.filter(poll=poll, cast=True).count()

    if (email_key.exists() and event.voters.filter(email=email_key[0].user.email).exists()):
        ballot = Ballot.objects.filter(voter=email_key[0].user, poll=poll)
        if (ballot.exists() and ballot[0].cast):
            has_voted = True

    if (access_key and email_key.exists()): #or (can_vote(request.user, event))
        voter_email = email_key[0].user.email
        can_vote = True

    if (request.method == "POST"):
        form = VoteForm(request.POST, instance=poll)
        if (email_key.exists()):
            #return HttpResponse(email_key[0].key)
            ballot = Ballot.objects.get_or_create(voter=email_key[0].user, poll=poll)[0]

        if (form.is_valid()):
            ballot.cipher_text_c1 = request.POST["cipher_text_c1"]
            ballot.cipher_text_c2 = request.POST["cipher_text_c2"]
            ballot.cast = True
            ballot.save()
            if (next_poll_index):
                return HttpResponseRedirect(reverse('polls:view-poll', kwargs={'event_id': event.id, 'poll_num': next_poll_index }) + "?key=" + email_key[0].key)
            else:
                return HttpResponse("Voted successfully!") # finished all polls in event

    return render(request, "polls/poll_detail.html",
        {"object": poll, "poll_num": poll_num , "event": event, "form": form, "poll_count": event.polls.all().count(),
            "prev_index": prev_poll_index , "next_index": next_poll_index,
            "can_vote": can_vote, "voter_email": voter_email, "has_voted": has_voted, "vote_count": vote_count
        })

def event_trustee_setup(request, event_id):
    event = get_object_or_404(Event, pk=event_id)
    access_key = request.GET.get('key', None)
    if (access_key):
        email_key = event.keys.filter(key=access_key)
        if (email_key.exists() and event.users_trustees.filter(email=email_key[0].user.email).exists()):
            if (TrusteeKey.objects.filter(event=event, user=email_key[0].user).exists()):
                messages.add_message(request, messages.WARNING, 'You have already submitted your key for this event')
                return HttpResponseRedirect(reverse("user_home"))
            if (request.method == "POST"):
                form = EventSetupForm(request.POST)
                if (form.is_valid()):
                    public_key = request.POST["public_key"]
                    key = TrusteeKey.objects.get_or_create(event=event, user=email_key[0].user)[0]
                    key.key = public_key
                    key.save()
                    if (event.trustee_keys.count() == event.users_trustees.count()): # ready for combpk
                        generate_combpk.delay(event)
                    messages.add_message(request, messages.SUCCESS, 'You have successfully submitted your public key for this event')
                    return HttpResponseRedirect(reverse("user_home"))
            else:
                form = EventSetupForm()
                return render(request, "polls/event_setup.html", {"event": event, "form": form })

    #if no key or is invalid?
    messages.add_message(request, messages.WARNING, 'You do not have permission to access: ' + request.path)
    return HttpResponseRedirect(reverse("user_home"))

def event_addec(request, event_id):
    event = get_object_or_404(Event, pk=event_id)
    for poll in event.polls.all():
        generate_enc.delay(poll)
    return HttpResponse("Generating enc.")

def event_trustee_decrypt(request, event_id):
    event = get_object_or_404(Event, pk=event_id)
    access_key = request.GET.get('key', None)
    if (access_key):
        email_key = event.keys.filter(key=access_key)
        if (email_key.exists() and event.users_trustees.filter(email=email_key[0].user.email).exists()):
            if (Decryption.objects.filter(event=event, user=email_key[0].user).exists()):
                messages.add_message(request, messages.WARNING, 'You have already provided your decryptions for this event')
                #if (event.decryptions.count() == (event.polls.count() * event.users_trustees.count())):
                #    tally_results.delay(event) # all keys are in
                return HttpResponseRedirect(reverse("user_home"))
            elif (request.method == "GET"):
                initial = []
                for poll in event.polls.all():
                    initial.append({'text': poll.enc })
                formset = DecryptionFormset(initial=initial)
            else:
                formset = DecryptionFormset(request.POST)
                data = []
                for form in formset:
                    if form.is_valid():
                        data.append(form.cleaned_data.get('text'))
                if (len(data) == event.polls.count()):
                    for dec, poll in zip(data, event.polls.all()):
                        Decryption.objects.get_or_create(user=email_key[0].user, event=event, poll=poll, text=dec)
                    messages.add_message(request, messages.SUCCESS, 'Decryption complete.')
                    if (event.decryptions.count() == (event.polls.count() * event.users_trustees.count())):
                        tally_results.delay(event) # all keys are in
                else:
                    messages.add_message(request, messages.ERROR, 'You didn\'t provide decryptions for every poll. Please try again.')
                return HttpResponseRedirect(reverse("user_home"))
            return render(request, "polls/event_decrypt.html", {"event": event, "formset": formset, "helper": DecryptionFormSetHelper() })

    messages.add_message(request, messages.WARNING, 'You do not have permission to decrypt this Event.')
    return HttpResponseRedirect(reverse("user_home"))

def test_poll_vote(request, poll_id):
    poll = get_object_or_404(Poll, pk=poll_id)
    form = VoteForm(instance=poll)
    return render(request, "polls/vote_poll.html", {"vote_form": form, "poll": poll})

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
                for form in formset:
                    formset.save()
                    create_ballots.delay(poll)
                    messages.add_message(request, messages.SUCCESS, 'Poll created successfully')
                    return HttpResponseRedirect(reverse('polls:view-poll', kwargs={'event_id': poll.event_id, 'poll_num': event.polls.count() }))
        return render(request, "polls/create_poll.html", {"event": event, "question_form": form, "option_formset": formset})

    elif request.method == "GET":
        form = PollForm(prefix="main") #, instance=poll
        return render(request, "polls/create_poll.html", {"event": event, "question_form": form, "option_formset": formset})
    else:
        return HttpResponseNotAllowed()

def create_event(request):
    #return HttpResponse(param(str(len("lol_age"))))
    event = Event()
    if request.method == "POST":
        '''if request.FILES: # if there is a file we should ignore voters...?
            csvfile = StringIO(request.FILES['votersTextFile'].read().decode('utf-8'))
            print("got file from request:")

        form = EventForm(request.POST)
        organiser_formset = OrganiserFormSet(request.POST, prefix="formset_organiser") # incase form fails, we still want to retain formset data
        trustee_formset = TrusteeFormSet(request.POST, prefix="formset_trustee")
        if form.is_valid():
            event = form.save()
            generate_event_param.delay(event)
            if request.FILES:
                print("creating voters")
                create_voters.delay(csvfile, event) # this will be done on event launch ultimately
            


            if organiser_formset.is_valid():
                #event.users_organisers.clear()
                for oform in organiser_formset:
                    if (oform.cleaned_data.get('email')):
                        event.users_organisers.add(DemoUser.objects.get(email=oform.cleaned_data['email']))
                event.users_organisers.add(request.user) # always add editor/creator
                if trustee_formset.is_valid():
                    #event.users_trustees.clear()
                    for tform in trustee_formset:
                        if (tform.cleaned_data.get('email')):
                            event.users_trustees.add(EmailUser.objects.get_or_create(email=tform.cleaned_data['email'])[0])
                    return HttpResponseRedirect('/event/' + str(event.id) + '/create/poll') # change to reverse format

            
        return render(request, "polls/create_event.html", {"event": event, "form": form, "organiser_formset": organiser_formset, "trustee_formset": trustee_formset})'''

        adaptor = CreateNewEventModelAdaptor(request.POST, request.user)
        adaptor.updateModel()

        # TODO: Based on whether validation was successful within update model and whether
        # TODO: data was actually persisted, either perform a redirect (success) or flag an error

        return HttpResponseRedirect("/event/")
    elif request.method == "GET":
        # Obtain context data for the rendering of the html template
        events = Event.objects.all()
        demo_users = DemoUser.objects.all()

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

#class CreatePoll(generic.View):

def can_vote(user, event):
    if event.voters.filter(email=user.email).exists():
        return True
    return False