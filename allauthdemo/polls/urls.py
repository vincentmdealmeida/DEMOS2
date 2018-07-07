from django.conf.urls import url
from django.contrib.auth.decorators import login_required

from . import views

app_name = 'polls'

urlpatterns = [
    url(r'^$', login_required(views.EventListView.as_view()), name='index'),
    url(r'^create/$', login_required(views.create_event), name='create-event'),
    url(r'^(?P<pk>[0-9]+)/$', login_required(views.EventDetailView.as_view()), name='view-event'),
    url(r'^(?P<pk>[0-9]+)/polls/$', login_required(views.EventDetailPollsView.as_view()), name='event-polls'),
    url(r'^(?P<pk>[0-9]+)/entities/$', login_required(views.EventDetailEntitiesView.as_view()), name='event-entities'),
    url(r'^(?P<pk>[0-9]+)/advanced/$', login_required(views.EventDetailAdvancedView.as_view()), name='event-advanced'),
    url(r'^(?P<event_id>[0-9]+)/end/$', login_required(views.event_end), name='end-event'),
    url(r'^(?P<event_id>[0-9]+)/results/$', login_required(views.results), name='event-results'),
    url(r'^(?P<event_id>[0-9]+)/edit/$', login_required(views.edit_event), name='edit-event'),
    url(r'^(?P<event_id>[0-9]+)/delete/$', login_required(views.del_event), name='del-event'),
    url(r'^(?P<event_id>[0-9]+)/decrypt/$', views.event_trustee_decrypt, name='decrypt-event'),
    url(r'^(?P<event_id>[0-9]+)/prepare/$', views.event_trustee_setup, name='prepare-event'),
    url(r'^(?P<event_id>[0-9]+)/poll/(?P<poll_num>[0-9]+)/vote/$', views.event_vote, name='event-vote'),
    url(r'^(?P<event_id>[0-9]+)/create/poll/$', login_required(views.manage_questions), name='create-poll'),
    url(r'^(?P<event_id>[0-9]+)/poll/(?P<poll_num>[0-9]+)/edit$', login_required(views.edit_poll), name='edit-poll')
]
