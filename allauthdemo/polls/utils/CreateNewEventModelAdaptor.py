from datetime import datetime

from django.utils.dateparse import parse_datetime

from allauthdemo.polls.models import Event
from allauthdemo.polls.models import Poll
from allauthdemo.polls.models import PollOption
from allauthdemo.polls.models import EmailUser
from allauthdemo.auth.models import DemoUser

'''
    Goal: Convert the new form data (from the updated DEMOS2 UI) returned to '/event/create' into
          an Event object that can be persisted via a Model to the DB

    Author: Vincent de Almeida

    Created: 11/07/2018
'''

# TODO: Define a validation function that can do back-end verification on top of the front end validation
# TODO: Validation can make use of __contains__ from QueryDict:
# TODO: https://docs.djangoproject.com/en/2.0/ref/request-response/#django.http.QueryDict

class CreateNewEventModelAdaptor:
    # Raw data from form and django
    form_data = None
    user = None

    # Extracted form data
    event_name = None
    identifier = None
    starts_at = None
    ends_at = None
    min_num_selections = 0
    max_num_selections = 0
    organisers = []
    trustees = []
    voters = []

    # Each element of the map has a sub array with 2 elements - poll and associated options
    polls_options_map = []

    # Event Model Object containing all the extracted data
    event = None

    def __init__(self, form_data, user):
        self.form_data = form_data.copy()
        self.user = user
        # TODO: Call validation func here (incl functionality for verifying CSRF + reCAPTCHA)
        self.__extractData()


    def __extractData(self):
        # Extract name and identifier first
        self.event_name = self.form_data.pop('name-input')[0]
        self.identifier = self.form_data.pop('identifier-input')[0]

        # Extract start and end times as string and convert to datetime
        # The UTC offset comes with a colon i.e. '+01:00' which needs to be removed
        starts_at = self.form_data.pop('vote-start-input')[0]
        starts_at_offset_index = starts_at.find('+')

        if starts_at_offset_index != -1:
            starts_at_time = starts_at[0: starts_at_offset_index-1].replace(' ', 'T')
            starts_at_offset = starts_at[starts_at_offset_index:].replace(':', '')
            starts_at = starts_at_time + starts_at_offset
            self.starts_at = parse_datetime(starts_at)
        else:
            self.starts_at = datetime.strptime(starts_at, '%Y-%m-%d %H:%M')


        ends_at = self.form_data.pop('vote-end-input')[0]
        ends_at_offset_index = ends_at.find('+')

        if ends_at_offset_index != -1:
            ends_at_time = ends_at[0:ends_at_offset_index-1].replace(' ', 'T')
            ends_at_offset = ends_at[ends_at_offset_index:].replace(':', '')
            ends_at = ends_at_time + ends_at_offset
            self.ends_at = parse_datetime(ends_at)
        else:
            self.ends_at = datetime.strptime(ends_at, '%Y-%m-%d %H:%M')

        # Extract the list of organisers
        organisers_list = self.form_data.pop('organiser-email-input')

        for organiser in organisers_list:
            if organiser != '' and DemoUser.objects.filter(email=organiser).count() == 1:
                self.organisers.append(DemoUser.objects.filter(email=organiser).get())

        # Extract the list of trustees
        trustees_list = self.form_data.pop('trustee-email-input')

        for trustee in trustees_list:
            if trustee != '':
                if EmailUser.objects.filter(email=trustee).count() == 1:
                    self.trustees.append(EmailUser.objects.filter(email=trustee).get())
                else:
                    self.trustees.append(EmailUser(email=trustee))

        # Extract the email list of voters
        voters_csv_string = self.form_data.pop('voters-list-input')[0].replace(' ', '')
        voters_email_list = voters_csv_string.split(',')

        for voter_email in voters_email_list:
            if voter_email != '':
                if EmailUser.objects.filter(email=voter_email).count() == 1:
                    self.voters.append(EmailUser.objects.filter(email=voter_email).get())
                else:
                    self.voters.append(EmailUser(email=voter_email))


        # Extract the min and max number of selections
        self.min_num_selections = int(self.form_data.pop('minimum-input')[0])
        self.max_num_selections = int(self.form_data.pop('maximum-input')[0])

        # Create the Event model object - this does not persist it to the DB
        self.event = Event(start_time=self.starts_at,
                           end_time=self.ends_at,
                           title=self.event_name,
                           EID=self.identifier,
                           creator=self.user.first_name + ' ' + self.user.last_name,
                           c_email=self.user.email,
                           trustees=voters_csv_string)


    def __gen_polls_options_map(self):
        # At the time of writing, you can only define one poll at event-creation time

        # Generate PollOption objects from the option data defined in form_data
        options = self.form_data.pop('option-name-input')
        poll_options_list = []

        for option in options:
            if option != '':
                poll_options_list.append(PollOption(choice_text=option, votes=0))

        # Extract required Poll object data and create a poll with its PollOption objects
        text = self.form_data.pop('question-input')[0]
        votes = 0

        poll = Poll(question_text=text,
                    total_votes=votes,
                    min_num_selections=self.min_num_selections,
                    max_num_selections=self.max_num_selections,
                    event=self.event)

        self.polls_options_map.append([poll, poll_options_list])

    # Instantiate all the polls and their associated poll options
    def __get_instantiated_polls(self):
        polls = []
        for poll_option_map in self.polls_options_map:
            poll = poll_option_map[0]
            poll_options = poll_option_map[1]

            # Save the poll to the db
            poll.save()

            # Instantiate poll options
            for option in poll_options:
                option.question = poll
                option.save()

            poll.options = poll_options
            poll.save()

            polls.append(poll)

        return polls

    def updateModel(self):
        # First thing to do is persist the event object to the db
        # with basic data before adding things like poll data
        self.event.save()

        # List of organisers should already be instantiated and present in the db
        # so it can just be added
        self.event.users_organisers = self.organisers

        # Add the list of trustees to the event, making sure they're instantiated
        for trustee in self.trustees:
            if EmailUser.objects.filter(email=trustee.email).count() == 0:
                trustee.save()

        self.event.users_trustees = self.trustees

        # Add the list of voters to the event, making sure they're instantiated
        for voter in self.voters:
            if EmailUser.objects.filter(email=voter.email).count() == 0:
                voter.save()

        self.event.voters = self.voters

        # Extract all the poll data for the event and associated poll option data
        # This can only be done at this point as the event has been persisted
        self.__gen_polls_options_map()

        # Get the instantiated list of polls which have already instantiated options
        self.event.polls = self.__get_instantiated_polls()

        self.event.save()

        # Finally perform a data clean up
        self.__clear_data()

    def __clear_data(self):
        self.form_data = None
        self.user = None
        self.event_name = None
        self.identifier = None
        self.starts_at = None
        self.ends_at = None
        self.min_num_selections = 0
        self.max_num_selections = 0
        self.organisers[:] = []
        self.trustees[:] = []
        self.voters[:] = []
        self.polls_options_map[:] = []
        self.event = None

