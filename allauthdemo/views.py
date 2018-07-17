from django.template import RequestContext
from django.contrib.auth.decorators import login_required
from django.views import generic
from allauthdemo.polls.models import Event
from django.shortcuts import render_to_response


@login_required
def member_index(request):
    return render_to_response("member/member-index.html", RequestContext(request))


class MemberEvents(generic.ListView):
    model = Event
    template_name = 'member/member-events.html'

    def get_context_data(self, **kwargs):
        context = super(MemberEvents, self).get_context_data(**kwargs)
        # no check needed for anon, as url should make sure we're logged in!
        return context

    def get_queryset(self):
        return self.request.user.organisers.all()


@login_required
def member_action(request):
    return render_to_response("member/member-action.html", RequestContext(request))
