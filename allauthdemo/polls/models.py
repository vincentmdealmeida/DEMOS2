from __future__ import unicode_literals

from django.db import models

from django import forms

# Create your models here.

import datetime

from django.utils import timezone

from allauthdemo.auth.models import DemoUser

class EmailUser(models.Model):
    email = models.CharField(max_length=80, unique=True)
    def __unicode__(self):
        return self.email

class Event(models.Model):
    users_organisers = models.ManyToManyField(DemoUser, blank=True, related_name="organisers")
    users_trustees = models.ManyToManyField(EmailUser, blank=True, related_name="trustees")
    voters = models.ManyToManyField(EmailUser, blank=True, related_name="voters")
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    prepared = models.BooleanField(default=False)
    public_key = models.CharField(null=True, blank=False, max_length=1024)
    title = models.CharField(max_length=1024)
    EID = models.CharField(max_length=2048, blank=True)
    creator = models.CharField(max_length=256, blank=True)
    c_email = models.CharField(max_length=512, blank=True)
    trustees = models.CharField(max_length=4096)

    def __str__(self):
        return self.title


class TrusteeKey(models.Model):
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="trustee_keys")
    user = models.ForeignKey(EmailUser, on_delete=models.CASCADE, related_name="trustee_keys")
    key = models.CharField(max_length=1024, unique=True) # ideally composite key here, but django doesn't really support yet

class AccessKey(models.Model):
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="keys")
    user = models.ForeignKey(EmailUser, on_delete=models.CASCADE, related_name="keys")
    key = models.CharField(max_length=1024, unique=True) # ideally composite key here, but django doesn't really support yet

    #total = models.IntegerField(blank=True, null=True, default=0)

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
    enc = models.CharField(max_length=4096, null=True)

    #index = models.IntegerField()

    def __str__(self):
        return self.question_text

class Decryption(models.Model):
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="decryptions")
    poll = models.ForeignKey(Poll, on_delete=models.CASCADE, related_name="decryptions")
    user = models.ForeignKey(EmailUser, on_delete=models.CASCADE, related_name="decryptions")
    text = models.CharField(max_length=1024)

#some modification to this class
class Ballot(models.Model):
    voter = models.ForeignKey(EmailUser, on_delete=models.CASCADE, related_name="ballots")
    poll = models.ForeignKey(Poll, on_delete=models.CASCADE, related_name="ballots")
    cipher_text_c1 = models.CharField(max_length=4096)#the encryption system uses two byte strings
    cipher_text_c2 = models.CharField(max_length=4096)
    cast = models.BooleanField(default=False)

class PollOption(models.Model):
    choice_text = models.CharField(max_length=200)
    votes = models.IntegerField(default=0)
    question = models.ForeignKey(Poll, on_delete=models.CASCADE, related_name="options")
    #index = models.IntegerField()

    def __str__(self):
        return self.choice_text

class Organiser(models.Model):
    index = models.IntegerField(default=0)
    email = models.CharField(max_length=100, blank=False, null=False)
    event = models.ForeignKey(Event, on_delete=models.CASCADE)

'''
class Organiser(models.Model):
    user = models.ForeignKey(DemoUser, on_delete=models.CASCADE)
    event = models.ForeignKey(Event, on_delete=models.CASCADE)

class Trustee(models.Model):
    user = models.ForeignKey(DemoUser, on_delete=models.CASCADE)
    event = models.ForeignKey(Event, on_delete=models.CASCADE)
    '''
#class EventOrganisers():
    #event = models.ForeignKey(Event, on_delete=models.CASCADE)
