from django.template import RequestContext
from django.shortcuts import render_to_response, render
from django.contrib.auth.decorators import login_required
from django.http import HttpResponseRedirect
from django.views import generic
from allauthdemo.polls.models import Event
from django.shortcuts import get_object_or_404, render, render_to_response

@login_required
def member_index(request):
    return render_to_response("member/member-index.html", RequestContext(request))


#def member_events(request):
    #self.publisher = get_object_or_404(Publisher, name=self.args[0])
    #return Book.objects.filter(publisher=self.publisher)
    #return render_to_response("member/member-events.html", RequestContext(request))

class MemberEvents(generic.ListView):
    model = Event
    template_name = 'member/member-events.html'

    def get_context_data(self, **kwargs):
        context = super(MemberEvents, self).get_context_data(**kwargs)
        #self.object.organisers.filter(email=self.request.user.email())
        # no check needed for anon, as url should make sure we're logged in!
        return context

    def get_queryset(self):
        #self.publisher = get_object_or_404(Publisher, name=self.args[0])
        return self.request.user.organisers.all()

@login_required
def member_action(request):
    return render_to_response("member/member-action.html", RequestContext(request))




'''

class EventListView(generic.ListView):

    model = Event

    def get_context_data(self, **kwargs):
        context = super(EventListView, self).get_context_data(**kwargs)
        #context['now'] = timezone.now()
        return context

    def get_context_data(self, **kwargs):
        context = super(EventDetailView, self).get_context_data(**kwargs)
        context['is_organiser'] = ((not self.request.user.is_anonymous()) and (self.object.users.filter(email=self.request.user.email).exists()))
        #context['now'] = timezone.now()
        return context

class PollDetailView(generic.DetailView):

    model = Poll

    def get_context_data(self, **kwargs):
        context = super(PollDetailView, self).get_context_data(**kwargs)
        #context['now'] = timezone.now()
        context['form'] = VoteForm(instance=self.object)
        context['poll_count'] = self.object.event.polls.all().count()
        return context

'''
