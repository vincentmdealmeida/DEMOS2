from __future__ import absolute_import

import base64
import json
from os import urandom
from celery import task

from django.core.exceptions import ValidationError
from django.core.validators import EmailValidator
from django.core.mail import send_mail
from django.conf import settings

from allauthdemo.polls.models import AccessKey

from .crypto_rpc import param, combpk, addec, tally

'''
    Goal: This py file defines celery tasks that can be initiated
    
    The following tasks were re-implemented by Thomas Smith: generate_event_param, tally_results, generate_combpk, generate_enc
    
    This file was also updated by Vincent de Almeida 
'''

# Will store the result of the initial cal to param() from .cpp_calls
group_param = None

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

'''
    Will generate a key for accessing either the event preparation page or the voting page
'''
def gen_access_key():
    return base64.urlsafe_b64encode(urandom(16)).decode('utf-8')

'''
    Emails an event preparation URL containing an access key for all of the trustees for an event 
'''
@task()
def email_trustees_prep(trustees, event):
    email_subject = "Key Generation and Preparation for Event '" + event.title + "'"

    # Plain text email - this could be replaced for a HTML-based email in the future
    email_body = "Please visit the following URL to prepare the event and generate your trustee secret key:\n\n"
    url_base = "http://" + settings.DOMAIN + "/event/" + str(event.pk) + "/prepare/?key="
    email_body = email_body + url_base

    for trustee in trustees:
        # Generate a key and create an AccessKey object
        key = gen_access_key()
        AccessKey.objects.create(user=trustee, event=event, key=key)

        trustee.send_email(email_subject, email_body + key)

'''
    Emails the access keys for all of the voters for an event 
'''
@task()
def email_voters_a_key(voters, event):
    email_subject = "Voting Access for Event '" + event.title + "'"
    email_body = 'Key: '

    for voter in voters:
        # Generate a key and create an AccessKey object
        key = gen_access_key()
        AccessKey.objects.create(user=voter, event=event, key=key)

        voter.send_email(email_subject, email_body + key)

'''
    Updates the EID of an event to contain 2 event IDs: a human readable one (hr) and a crypto one (GP from param())
'''
@task()
def update_EID(event):
    global group_param
    if group_param is None:
        group_param = param()

    EID = {}
    EID['hr'] = event.EID
    EID['crypto'] = group_param
    event.EID = json.dumps(EID)
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


