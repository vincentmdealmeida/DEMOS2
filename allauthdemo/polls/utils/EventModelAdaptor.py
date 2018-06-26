import re

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

    Created: 11/06/2018
'''

# TODO: Define a validation function that can do back-end verification on top of the front end validation
# TODO: Validation can make use of __contains__ from QueryDict:
# TODO: https://docs.djangoproject.com/en/2.0/ref/request-response/#django.http.QueryDict

class EventModelAdaptor:
    # Raw data from form and django
    form_data = None
    user = None

    # Used for validating the form data
    form_data_validation = None
    invalid_form_fields = {}
    validation_starts_at = None
    validation_ends_at = None

    # Extracted form data
    event_name = None
    identifier = None
    starts_at = None
    ends_at = None
    organisers = []
    trustees = []
    voters = []

    # Each element of the map has a sub array with 2 elements - poll and associated options
    polls_options_map = []

    # Event Model Object containing all the extracted data
    event = None

    def __init__(self, form_data, user):
        self.form_data = form_data.copy()
        self.form_data_validation = form_data.copy()
        self.user = user

    def isFormDataValid(self, events, demo_users):
        nameValid = self.__isNameValid(events)
        identifierValid = self.__isIdentifierValid(events)
        eventTimingsValid = self.__isEventTimingsValid()
        pollsValid = self.__arePollsValid()
        organisersEmailsValid = self.__areOrganisersEmailsValid(demo_users)
        trusteesEmailsValid = self.__areTrusteeEmailsValid()
        votersListValid = self.__isVotersListValid()

        return nameValid \
               and identifierValid \
               and eventTimingsValid \
               and pollsValid \
               and organisersEmailsValid \
               and trusteesEmailsValid \
               and votersListValid

    def __isNameValid(self, events):
        valid = True

        event_name = self.form_data_validation.pop('name-input')[0]

        if event_name == '':
            self.invalid_form_fields['event_name'] = {'error': 'The event name field is blank.'}
            valid = False
        else:
            for event in events:
                if event.title == event_name:
                    self.invalid_form_fields['event_name'] = {'error': "The event name '" + event_name + "' is already in use."}
                    valid = False
                    break

        self.invalid_form_fields['event_name_data'] = {'val': event_name}

        return valid

    def __isIdentifierValid(self, events):
        valid = True

        identifier = self.form_data_validation.pop('identifier-input')[0]

        if identifier == '':
            self.invalid_form_fields['identifier'] = {'error': 'The event slug field is blank.'}
            valid = False
        else:
            for event in events:
                if event.EID == identifier:
                    self.invalid_form_fields['identifier'] = {'error': "The event slug '" + identifier + "' is already in use."}
                    valid = False
                    break

        self.invalid_form_fields['identifier_data'] = {'val': identifier}

        return valid

    def __isVoteStartValid(self):
        valid = True

        # Extract start and end times as string and convert to datetime to perform validation
        # The UTC offset comes with a colon i.e. '+01:00' which needs to be removed
        validation_error = "The voting start date and time format is invalid."
        starts_at_input = self.form_data_validation.pop('vote-start-input')[0]

        if starts_at_input == '':
            self.invalid_form_fields['starts_at'] = {'error': 'The voting start time is blank.'}
            return False

        starts_at = starts_at_input
        starts_at_offset_index = starts_at.find('+')

        if starts_at_offset_index != -1:
            # timezone data has been supplied so use parse_datetime from django
            starts_at_time = starts_at[0: starts_at_offset_index - 1].replace(' ', 'T')
            starts_at_offset = starts_at[starts_at_offset_index:].replace(':', '')
            starts_at = starts_at_time + starts_at_offset

            try:
                starts_at = parse_datetime(starts_at)

                if starts_at is None:
                    self.invalid_form_fields['starts_at'] = {'error': validation_error}
                    valid = False
            except ValueError:
                self.invalid_form_fields['starts_at'] = {'error': validation_error}
                valid = False
        else:
            # No Timezone data has been supplied so use strptime instead
            try:
                starts_at = datetime.strptime(starts_at, '%Y-%m-%d %H:%M')

                if starts_at is None:
                    self.invalid_form_fields['starts_at'] = {'error': validation_error}
                    valid = False
            except ValueError:
                self.invalid_form_fields['starts_at'] = {'error': validation_error}
                valid = False

        self.validation_starts_at = starts_at
        self.invalid_form_fields['starts_at_data'] = {'val': starts_at_input}

        return valid

    def __isVoteEndValid(self):
        valid = True

        validation_error = "The voting end date and time format is invalid."
        ends_at_input = self.form_data_validation.pop('vote-end-input')[0]

        if ends_at_input == '':
            self.invalid_form_fields['ends_at'] = {'error': 'The voting end time is blank.'}
            return False

        ends_at = ends_at_input
        ends_at_offset_index = ends_at.find('+')

        if ends_at_offset_index != -1:
            # timezone data has been supplied so use parse_datetime from django
            ends_at_time = ends_at[0:ends_at_offset_index - 1].replace(' ', 'T')
            ends_at_offset = ends_at[ends_at_offset_index:].replace(':', '')
            ends_at = ends_at_time + ends_at_offset

            try:
                ends_at = parse_datetime(ends_at)

                if ends_at is None:
                    self.invalid_form_fields['ends_at'] = {'error': validation_error}
                    valid = False
            except ValueError:
                self.invalid_form_fields['ends_at'] = {'error': validation_error}
                valid = False
        else:
            # No Timezone data has been supplied so use strptime instead
            try:
                ends_at = datetime.strptime(ends_at, '%Y-%m-%d %H:%M')

                if ends_at is None:
                    self.invalid_form_fields['ends_at'] = {'error': validation_error}
                    valid = False
            except ValueError:
                self.invalid_form_fields['ends_at'] = {'error': validation_error}
                valid = False

        # Store the ends_at for further validation as well as the original data val
        self.validation_ends_at = ends_at
        self.invalid_form_fields['ends_at_data'] = {'val': ends_at_input}

        return valid

    def __isEventTimingsValid(self):
        # Ensure that the start and end times are independently valid and then ensure they don't overlap
        # in an invalid manner
        voteStartValid = self.__isVoteStartValid()
        voteEndValid = self.__isVoteEndValid()
        eventTimingsValid = True

        # Ensure that the start date is before the end date and that the end is after the start
        if voteStartValid and voteEndValid:
            if not self.validation_starts_at < self.validation_ends_at and self.validation_ends_at > self.validation_starts_at:
                self.invalid_form_fields['event_timings'] = {'error': 'The start date must be before the end date and the end after the start date.'}
                eventTimingsValid = False

        return voteStartValid and voteEndValid and eventTimingsValid

    def __arePollsValid(self):
        valid = True

        # Get the poll count
        poll_count = int(self.form_data_validation.pop('poll-count-input')[0])
        polls_json = []
        errors_summary = "The following poll # have errors: "

        for i in range(poll_count):
            # Whether there are errors for this specific poll
            poll_valid = True

            # JSON representation of the poll
            poll_json = {}

            # JSON struct for defining errors in the poll
            poll_errors_json = {}

            # String version of i
            i_str = str(i)
            poll_json['no'] = {'val': i_str}

            # Inspect all of the options for this poll
            options = self.form_data_validation.pop('option-name-input-' + i_str)
            options_list = []
            blank_count = 0

            for option in options:
                if option == '':
                    blank_count += 1
                else:
                    options_list.append(option)

            # Add back the blank options to the option list not including the hidden one
            for i in range(blank_count-1):
                options_list.append("")

            # blank count is expected to be 1 due to the hidden option row that's cloned in the
            # front end every time a new option is added
            if blank_count > 1:
                poll_errors_json['options'] = {'val': "There are " + str(blank_count-1) + " blank poll options"}
                valid = False
                poll_valid = False

            poll_json['options'] = {'val': options_list}

            # Ensure that the poll question / statement isn't blank
            name = self.form_data_validation.pop('question-name-input-' + i_str)[0]

            if name == '':
                poll_errors_json['name'] = {'val': "The poll name is blank."}
                valid = False
                poll_valid = False

            # Record the poll name in the JSON representation of the poll
            poll_json['name'] = {'val': name}

            # Validate the min max poll option selections
            min_num_selections_str = self.form_data_validation.pop('minimum-input-' + i_str)[0]
            max_num_selections_str = self.form_data_validation.pop('maximum-input-' + i_str)[0]
            errors = ""

            if min_num_selections_str == '':
                errors = "The minimum selection cannot be blank. "
                valid = False
                poll_valid = False
            else:
                min_num_selections = None

                try:
                    min_num_selections = int(min_num_selections_str)

                    if min_num_selections < 0:
                        errors = "The minimum selection cannot be less than zero. "
                        valid = False
                        poll_valid = False

                    if min_num_selections > len(options) - blank_count:
                        if len(errors) > 0:
                            errors = errors + "and it cannot be more than the number of options. "
                        else:
                            errors = "The minimum selection cannot be greater than the number of options. "

                        valid = False
                        poll_valid = False

                    if max_num_selections_str == '':
                        max_sel_blank_err = "The maximum selection cannot be blank. "

                        if len(errors) > 0:
                            errors = errors + max_sel_blank_err
                        else:
                            errors = max_sel_blank_err

                        valid = False
                        poll_valid = False
                    else:
                        max_num_selections = None

                        try:
                            max_num_selections = int(max_num_selections_str)

                            if min_num_selections > max_num_selections:
                                min_gt_max_err = "The minimum selection cannot be greater than the maximum. "
                                if len(errors) > 0:
                                    errors = errors + min_gt_max_err
                                else:
                                    errors = min_gt_max_err

                                valid = False
                                poll_valid = False

                            if max_num_selections < 0:
                                max_less_zero_err = "The maximum cannot be less than 0. "

                                if len(errors) > 0:
                                    errors = errors + max_less_zero_err
                                else:
                                    errors = max_less_zero_err

                                valid = False
                                poll_valid = False

                            if max_num_selections > len(options) - blank_count:
                                max_options_err = "The max number of option selections cannot be more than the number of options."

                                if len(errors) > 0:
                                    errors = errors + max_options_err
                                else:
                                    errors = max_options_err

                                valid = False
                                poll_valid = False

                            # Record the min max poll option selection values in the JSON rep of the poll
                            poll_json['min_selection'] = {'val': min_num_selections}
                            poll_json['max_selection'] = {'val': max_num_selections}
                        except ValueError:
                            max_opts_input_err = "The maximum option selection input is not valid. "

                            if len(errors) > 0:
                                errors = errors + max_opts_input_err
                            else:
                                errors = max_opts_input_err

                            valid = False
                            poll_valid = False
                except ValueError:
                    errors = "The minimum option selection input is not valid."
                    valid = False
                    poll_valid = False

            poll_errors_json['min_max'] = {'val': errors}

            # Store the errors as part of the JSON rep of the poll
            poll_json['errors'] = {'val': poll_errors_json}

            # Add the poll rep to the list of polls
            polls_json.append(poll_json)

            # If the validation for the poll has failed, add it to the error summary
            if not poll_valid:
                errors_summary = errors_summary + str(i + 1) + " "

        self.invalid_form_fields['polls_data'] = {'val': polls_json}

        if not valid and len(errors_summary) > 34:
            errors_summary = errors_summary + "and can be corrected by editing them."
            self.invalid_form_fields['polls_errors'] = {'error': errors_summary}

        return valid

    def __areOrganisersEmailsValid(self, demo_users):
        valid = True

        # Create a list of emails from the demo users
        emails = []
        for user in demo_users:
            emails.append(user.email)

        # Check that the list of organiser emails are actually valid
        organisers_list_input = self.form_data_validation.pop('organiser-email-input')
        organisers_list = []
        blank_count = 0
        error = "The following email(s) supplied are not organisers: "

        for organiser in organisers_list_input:
            if organiser != '':
                organisers_list.append(organiser)

                if organiser not in emails:
                    error = error + organiser + " "
                    valid = False
            else:
                blank_count += 1

        if blank_count > 1:
            if not valid:
                error = error + " and there are " + str(blank_count - 1) + " blank organiser inputs."
            else:
                error = "There are " + str(blank_count - 1) + " blank organiser inputs."
                valid = False

            # This adds in blank organisers so that the template can render them for the user to fix
            for i in range(blank_count - 1):
                organisers_list.append("")

        if not valid:
            self.invalid_form_fields['organiser_emails'] = {'error': error}

        self.invalid_form_fields['organiser_emails_data'] = {'val': organisers_list}

        return valid

    def __areTrusteeEmailsValid(self):
        valid = True

        # Check that the list of trustees is valid
        trustees_list_input = self.form_data_validation.pop('trustee-email-input')
        trustees_list = []
        error = "The following email(s) supplied are not valid: "
        blank_count = 0

        for trustee in trustees_list_input:
            if trustee != '':
                trustees_list.append(trustee)
                match = re.match(r'[^\s@]+@[^\s@]+\.[^\s@]+', trustee)

                if match is None:
                    error = error + trustee + " "
                    valid = False
            else:
                blank_count += 1

        if blank_count > 1:
            if not valid:
                error = error + " and there are " + str(blank_count - 1) + " blank trustee inputs."
            else:
                error = "There are " + str(blank_count - 1) + " blank trustee inputs."
                valid = False

            # This adds in blank trustees so that the template can render them for the user to fix
            for i in range(blank_count - 1):
                trustees_list.append("")

        if not valid:
            self.invalid_form_fields['trustee_emails'] = {'error': error}

        self.invalid_form_fields['trustee_emails_data'] = {'val': trustees_list}

        return valid

    def __isVotersListValid(self):
        valid = True

        # Check that the list of voters is valid
        voters_csv_string = self.form_data_validation.pop('voters-list-input')[0].replace(' ', '')

        if voters_csv_string == '':
            self.invalid_form_fields['voters_emails'] = {'error': 'The voters list is blank.'}
            self.invalid_form_fields['voters_emails_data'] = {'val': voters_csv_string}
            return False

        voters_email_list = voters_csv_string.split(',')
        error = "The following email(s) supplied are not valid: "

        for voter_email in voters_email_list:
            if voter_email != '' and re.match(r'[^\s@]+@[^\s@]+\.[^\s@]+', voter_email) is None:
                error = error + voter_email + " "
                valid = False

        if not valid:
            self.invalid_form_fields['voters_emails'] = {'error': error}

        self.invalid_form_fields['voters_emails_data'] = {'val': voters_csv_string}

        return valid

    def getInvalidFormFields(self):
        return self.invalid_form_fields

    def extractData(self):
        # Extract name and identifier first
        self.event_name = self.form_data.pop('name-input')[0]
        self.identifier = self.form_data.pop('identifier-input')[0]

        # Extract start and end times as string and convert to datetime
        # The UTC offset comes with a colon i.e. '+01:00' which needs to be removed
        starts_at = self.form_data.pop('vote-start-input')[0]
        starts_at_offset_index = starts_at.find('+')

        if starts_at_offset_index != -1:
            # timezone data has been supplied so use parse_datetime from django
            starts_at_time = starts_at[0: starts_at_offset_index-1].replace(' ', 'T')
            starts_at_offset = starts_at[starts_at_offset_index:].replace(':', '')
            starts_at = starts_at_time + starts_at_offset
            self.starts_at = parse_datetime(starts_at)
        else:
            # No Timezone data has been supplied so use strptime instead
            self.starts_at = datetime.strptime(starts_at, '%Y-%m-%d %H:%M')


        ends_at = self.form_data.pop('vote-end-input')[0]
        ends_at_offset_index = ends_at.find('+')

        if ends_at_offset_index != -1:
            # timezone data has been supplied so use parse_datetime from django
            ends_at_time = ends_at[0:ends_at_offset_index-1].replace(' ', 'T')
            ends_at_offset = ends_at[ends_at_offset_index:].replace(':', '')
            ends_at = ends_at_time + ends_at_offset
            self.ends_at = parse_datetime(ends_at)
        else:
            # No Timezone data has been supplied so use strptime instead
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

        # Create the Event model object - this does not persist it to the DB
        self.event = Event(start_time=self.starts_at,
                           end_time=self.ends_at,
                           title=self.event_name,
                           EID=self.identifier,
                           creator=self.user.first_name + ' ' + self.user.last_name,
                           c_email=self.user.email,
                           trustees=voters_csv_string)


    def __gen_polls_options_map(self):
        # Get the poll count (the number of poll and options that have been defined)
        poll_count = int(self.form_data.pop('poll-count-input')[0])

        for i in range(poll_count):
            # String version of i
            i_str = str(i)

            # Generate PollOption objects from the option data defined in form_data
            options = self.form_data.pop('option-name-input-' + i_str)
            poll_options_list = []
            votes = 0

            for option in options:
                if option != '':
                    poll_options_list.append(PollOption(choice_text=option, votes=votes))

            # Extract required Poll object data and create a poll with its PollOption objects
            text = self.form_data.pop('question-name-input-' + i_str)[0]
            min_num_selections = int(self.form_data.pop('minimum-input-' + i_str)[0])
            max_num_selections = int(self.form_data.pop('maximum-input-' + i_str)[0])

            poll = Poll(question_text=text,
                        total_votes=votes,
                        min_num_selections=min_num_selections,
                        max_num_selections=max_num_selections,
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
        self.form_data_validation = None
        self.invalid_form_fields = {}
        self.validation_starts_at = None
        self.validation_ends_at = None
        self.user = None
        self.event_name = None
        self.identifier = None
        self.starts_at = None
        self.ends_at = None
        self.organisers[:] = []
        self.trustees[:] = []
        self.voters[:] = []
        self.polls_options_map[:] = []
        self.event = None

