from django import template
from allauthdemo.polls.models import Ballot
from allauthdemo.polls.models import Poll

register = template.Library()


@register.filter
def get_ballot_value(option_no, options_count):
    ballot_value = ""

    for i in range(options_count):

        if (i+1) == option_no:
            ballot_value = ballot_value + "1"
        else:
            ballot_value = ballot_value + "0"

        if not i == (options_count-1):
            ballot_value = ballot_value + ","

    return ballot_value


@register.filter
def get_total_num_voters(poll_uuid):
    poll = Poll.objects.filter(uuid=poll_uuid).get()
    return Ballot.objects.filter(poll=poll).count()


@register.filter
def get_turnout(poll_uuid):
    poll = Poll.objects.filter(uuid=poll_uuid).get()
    voters_count = float(Ballot.objects.filter(poll=poll).count())
    turnout = float(poll.total_votes) / voters_count
    return "%.2f" % (turnout * 100)

