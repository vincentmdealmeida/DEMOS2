from django.conf.urls import url
from django.contrib.auth.decorators import login_required, permission_required

from . import views

app_name = 'polls'

#urlpatterns = [
#  url(r'^$', views.index, name='index'),
  # ex: /polls/5/
#  url(r'^(?P<question_id>[0-9]+)/$', views.detail, name='detail'),
  # ex: /polls/5/results/
#  url(r'^(?P<question_id>[0-9]+)/results/$', views.results, name='results'),
  # ex: /polls/5/vote/
#  url(r'^(?P<question_id>[0-9]+)/vote/$', views.vote, name='vote'),
#]

urlpatterns = [
    url(r'^vote/(?P<poll_id>[0-9]+)/$', views.test_poll_vote, name='vote-poll'),
    url(r'^(?P<pk>[0-9]+)/$', views.EventDetailView.as_view(), name='view-event'),
    url(r'^(?P<pk>[0-9]+)/polls$', views.EventDetailPollsView.as_view(), name='event-polls'),
    url(r'^(?P<pk>[0-9]+)/organisers$', views.EventDetailOrganisersView.as_view(), name='event-organisers'),
    url(r'^$', views.EventListView.as_view(), name='index'),
    url(r'^create/$', login_required(views.create_event), name='create-event'),
    url(r'^(?P<event_id>[0-9]+)/decrypt/$', login_required(views.event_trustee_decrypt), name='decrypt-event'),
    url(r'^(?P<event_id>[0-9]+)/prepare/$', login_required(views.event_trustee_setup), name='prepare-event'),
    url(r'^(?P<event_id>[0-9]+)/encrypt/$', login_required(views.event_addec), name='enc-event'),
    url(r'^(?P<pk>[0-9]+)/launch/$', views.EventDetailLaunchView.as_view(), name='launch-event'),
    url(r'^edit/(?P<event_id>[0-9]+)/$', login_required(views.edit_event), name='edit-event'),
    url(r'^(?P<event_id>[0-9]+)/create/poll/$', login_required(views.manage_questions), name='create-poll'),
    url(r'^(?P<event_id>[0-9]+)/poll/(?P<poll_num>[0-9]+)/$', login_required(views.view_poll), name='view-poll'),
    url(r'^(?P<event_id>[0-9]+)/poll/(?P<poll_num>[0-9]+)/edit$', login_required(views.edit_poll), name='edit-poll'),
    #url(r'^(?P<pk>[0-9]+)/$', login_required(views.DetailView.as_view()), name='detail'),
    #url(r'^(?P<pk>[0-9]+)/results/$', login_required(views.ResultsView.as_view()), name='results'),
    #url(r'^(?P<question_id>[0-9]+)/vote/$', login_required(views.vote), name='vote'),
]
