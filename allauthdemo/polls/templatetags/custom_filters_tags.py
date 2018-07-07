from django import template

register = template.Library()

#get a value for additively homomorphic encryption ballots
#we can't do maths in the template normally so a filter is a way around it
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
