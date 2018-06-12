from django import template

register = template.Library()

#get a value for additively homomorphic encryption ballots
#we can't do maths in the template normally so a filter is a way around it
@register.filter
def get_ballot_value(value):
	return pow(10, value-1)
