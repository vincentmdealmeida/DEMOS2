from __future__ import unicode_literals

import json
import uuid

from django.core.mail import send_mail
from django.db import models
from django.utils import timezone

from allauthdemo.auth.models import DemoUser


class EmailUser(models.Model):
    email = models.CharField(max_length=80, unique=True)

    def send_email(self, subject, message, from_email=None):
        """
        Sends an email to this User.
        """
        send_mail(subject, message, from_email, [self.email])

    def __unicode__(self):
        return self.email


class Event(models.Model):
    users_organisers = models.ManyToManyField(DemoUser, blank=True, related_name="organisers")
    users_trustees = models.ManyToManyField(EmailUser, blank=True, related_name="trustees")
    voters = models.ManyToManyField(EmailUser, blank=True, related_name="voters")
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    prepared = models.BooleanField(default=False)
    ended = models.BooleanField(default=False)
    public_key = models.CharField(null=True, blank=False, max_length=1024)
    title = models.CharField(max_length=1024)
    EID = models.CharField(max_length=2048, blank=True)
    creator = models.CharField(max_length=256, blank=True)
    c_email = models.CharField(max_length=512, blank=True)
    trustees = models.CharField(max_length=4096)
    uuid = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Custom helper methods
    def EID_hr(self):
        try:
            EID_json = json.loads(self.EID)
            return EID_json['hr']
        except ValueError:
            return self.EID

    def EID_crypto(self):
        try:
            EID_json = json.loads(self.EID)
            EID_crypto_str = EID_json['crypto']
            return json.dumps(json.loads(EID_crypto_str))
        except ValueError:
            return "None - Event not Initialised"

    def duration(self):
        duration_str = self.start_time_formatted()
        duration_str = duration_str + " - " + self.end_time_formatted_utc()
        return duration_str

    def start_time_formatted(self):
        return self.start_time.strftime("%d-%m-%y %H:%M")

    def start_time_formatted_utc(self):
        return self.start_time.strftime("%d-%m-%y %H:%M %Z")

    def end_time_formatted(self):
        return self.end_time.strftime("%d-%m-%y %H:%M")

    def end_time_formatted_utc(self):
        return self.end_time.strftime("%d-%m-%y %H:%M %Z")

    # Total number of options in all polls
    def total_num_opts(self):
        polls = self.polls.all()
        count = 0

        for poll in polls:
            count += poll.options.all().count()

        return count

    def total_num_partial_decs(self):
        polls = self.polls.all()
        count = 0

        for poll in polls:
            count += PartialBallotDecryption.objects.filter(poll=poll).count()

        return count

    def all_part_decs_received(self):
        received = False

        if self.total_num_partial_decs() == self.total_num_opts() * self.users_trustees.all().count():
            received = True

        return received

    def status(self):
        status_str = ""

        # Get the current date and time to compare against to establish if this is a past, current or
        # future event. Prepared means the public key has been initialised
        present = timezone.now()

        if self.ended is False:
            if present < self.start_time and self.prepared is False:
                status_str = "Future"
            elif present < self.start_time and self.prepared is True:
                status_str = "Prepared"
            elif present >= self.start_time and present <= self.end_time and self.prepared is True:
                status_str = "Active"
            elif present >= self.start_time and present <= self.end_time and self.prepared is False:
                status_str = "Future"
            elif present > self.end_time:
                status_str = "Expired"
        else:
            if self.all_part_decs_received():
                status_str = "Decrypted"
            else:
                status_str = "Ended"

        return status_str

    '''
        The result applies to all polls for an event so True will only be returned when votes have
        been received for every poll. 
    '''
    def has_received_votes(self):
        received_votes = True

        for poll in self.polls.all():
            if Ballot.objects.filter(poll=poll, cast=True).count() == 0:
                received_votes = False

        return received_votes

    def __str__(self):
        return self.title


class TrusteeKey(models.Model):
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="trustee_keys")
    user = models.ForeignKey(EmailUser, on_delete=models.CASCADE, related_name="trustee_keys")
    key = models.CharField(max_length=255, unique=True)


class AccessKey(models.Model):
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="keys")
    user = models.ForeignKey(EmailUser, on_delete=models.CASCADE, related_name="keys")
    key = models.CharField(max_length=255, unique=True)

    def has_started(self):
        return timezone.now() >= self.start

    def has_ended(self):
        return timezone.now() >= self.end

    def __unicode__(self):
        return self.title


class Poll(models.Model):
    question_text = models.CharField(max_length=200)
    total_votes = models.IntegerField(default=0)
    min_num_selections = models.IntegerField(default=0)
    max_num_selections = models.IntegerField(default=1)
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="polls")
    combined_ballots = models.CharField(max_length=4096, null=True)
    result_json = models.CharField(max_length=4096, null=True)
    uuid = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    def __str__(self):
        return self.question_text


class PollOption(models.Model):
    choice_text = models.CharField(max_length=200)
    votes = models.IntegerField(default=0)
    question = models.ForeignKey(Poll, on_delete=models.CASCADE, related_name="options")

    def __str__(self):
        return self.choice_text


class CombinedBallot(models.Model):
    poll = models.ForeignKey(Poll, on_delete=models.CASCADE, related_name="combined_ballot")
    option = models.ForeignKey(PollOption, on_delete=models.CASCADE, related_name="combined_ballot")
    cipher_text_c1 = models.CharField(max_length=4096)
    cipher_text_c2 = models.CharField(max_length=4096)


# A partial decryption supplied by a trustee for a combined ballot that relates to a poll option
class PartialBallotDecryption(models.Model):
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="decryption")
    poll = models.ForeignKey(Poll, on_delete=models.CASCADE, related_name="decryption")
    option = models.ForeignKey(PollOption, on_delete=models.CASCADE, related_name="decryption")
    user = models.ForeignKey(EmailUser, on_delete=models.CASCADE, related_name="decryption")
    text = models.CharField(max_length=4096)


class Ballot(models.Model):
    voter = models.ForeignKey(EmailUser, on_delete=models.CASCADE, related_name="ballots")
    poll = models.ForeignKey(Poll, on_delete=models.CASCADE, related_name="ballots")
    cast = models.BooleanField(default=False)


class EncBallot(models.Model):
    handle = models.CharField(primary_key=True, default=uuid.uuid4, editable=False, max_length=255)
    ballot = models.CharField(max_length=4096)


# Implements the new binary encoding scheme
class EncryptedVote(models.Model):
    ballot = models.ForeignKey(Ballot, on_delete=models.CASCADE, related_name="encrypted_vote")


class CombinedEncryptedVote(models.Model):
    ballot = models.ForeignKey(Ballot, on_delete=models.CASCADE, related_name="comb_encrypted_vote")


class VoteFragment(models.Model):
    encrypted_vote = models.ForeignKey(EncryptedVote, on_delete=models.CASCADE, related_name="fragment", null=True)
    comb_encrypted_vote = models.ForeignKey(CombinedEncryptedVote, on_delete=models.CASCADE, related_name="fragment", null=True)
    cipher_text_c1 = models.CharField(max_length=4096)
    cipher_text_c2 = models.CharField(max_length=4096)


