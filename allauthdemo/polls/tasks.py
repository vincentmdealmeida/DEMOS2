from __future__ import absolute_import
import csv
from os import urandom
import base64
from io import StringIO
from celery import task
from django.core.exceptions import ValidationError
from django.core.validators import EmailValidator
from django.core.mail import send_mail
from allauthdemo.polls.models import Ballot, Event, EmailUser, AccessKey
from .cpp_calls import param, combpk, addec, tally

def is_valid_email(email):
    try:
        valid_email = EmailValidator(whitelist=None)
        valid_email(email)
        return True
    except ValidationError:
        return False

@task()
def create_ballots(poll):
    for voter in poll.event.voters.all():
        ballot = poll.ballots.create(voter=voter, poll=poll)

@task()
def create_voters(csvfile, event):
    print("Creating voters for event " + event.title)
    reader = csv.reader(csvfile, delimiter=',')
    string = ""
    for row in reader:
        email = string.join(row)
        print(email)
        #testvoter = EmailUser.objects.get_or_create(email='notarealemail@live.com')[0]
        #event.voters.add(testvoter)
        if (is_valid_email(email)):
            voter = EmailUser.objects.get_or_create(email=email)[0]
            event.voters.add(voter)
            key = base64.urlsafe_b64encode(urandom(16)).decode('utf-8')
            AccessKey.objects.create(user=voter, event=event, key=key)
            send_mail(
                'Your Voting Key',
                'Key: ' + key,
                'from@example.com',
                [string.join(row)],
                fail_silently=False,
            )
'''

Starting here: functions re-implemented by Thomas Smith

'''
@task()
def generate_event_param(event):
    event.EID = param()
    event.save()

@task()
def tally_results(event):
    for poll in event.polls.all():
        decs = list()
        for dec in poll.decryptions.all():
            decs.append(dec.text)
        amount = len(decs)
        result = tally(amount, event.EID, decs, poll.enc)
        send_mail(
            'Your Results:',
            poll.question_text + ": " + result,
            'from@example.com',
            ["fake@fake.com"],
            fail_silently=False,
        )
        print(poll.question_text + ": " + result)

@task()
def generate_combpk(event):
    pks = list()
    for tkey in event.trustee_keys.all():
        pks.append(str(tkey.key))
    amount = len(pks)
    event.public_key = combpk(amount, pks)
    event.prepared = True
    event.save()

@task
def generate_enc(poll):
    c1s = list()#c1 components of ciphertexts
    c2s = list()#c1 components of ciphertexts
    for ballot in poll.ballots.all():
        if (ballot.cast):
            c1s.append(str(ballot.cipher_text_c1))
            c2s.append(str(ballot.cipher_text_c2))
    ciphers = {
        'c1s':c1s,
        'c2s':c2s
    }
    amount = len(c1s)
    poll.enc = addec(amount, ciphers)
    poll.save()

'''

End of re-implemented code

'''

@task()
def add(x, y):
    return x + y

@task()
def mul(x, y):
    return x * y

@task()
def xsum(numbers):
    return sum(numbers)
