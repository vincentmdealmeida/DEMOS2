from __future__ import absolute_import

import base64
import json
from os import urandom
from celery import task

from django.conf import settings

from allauthdemo.polls.models import AccessKey, Ballot, Decryption, TrusteeSK, EventSK

from .crypto_rpc import param, combpk, addec, tally, get_tally, combine_sks

'''
    Goal: This py file defines celery tasks that can be initiated
    
    The following tasks were re-implemented by Thomas Smith: generate_event_param, tally_results, generate_combpk, generate_enc
    
    This file was also updated by Vincent de Almeida 
'''

# Will store the result of the initial cal to param() from .cpp_calls
group_param = None

'''
    Helper functions
    
    gen_access_key - Will generate an a key for accessing either the event preparation page, voting page and decryption page
'''
def gen_access_key():
    return base64.urlsafe_b64encode(urandom(16)).decode('utf-8')

def email_trustees_dec(event):
    email_subject = "Event Ballot Decryption for '" + event.title + "'"

    # Plain text email - this could be replaced for a HTML-based email in the future
    email_body = "Please visit the following URL to submit your trustee secret key to begin event decryption:\n\n"
    url_base = "http://" + settings.DOMAIN + "/event/" + str(event.pk) + "/decrypt/?key="
    email_body = email_body + url_base

    for trustee in event.users_trustees.all():
        # Generate a key and create an AccessKey object
        key = gen_access_key()
        AccessKey.objects.create(user=trustee, event=event, key=key)

        trustee.send_email(email_subject, email_body + key)

@task()
def create_ballots(event):
    voters = event.voters.all()

    for poll in event.polls.all():
        for voter in voters:
            ballot = poll.ballots.create(voter=voter, poll=poll)

@task()
def create_ballots_for_poll(poll):
    for voter in poll.event.voters.all():
        ballot = poll.ballots.create(voter=voter, poll=poll)


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
    Emails a URL containing an access key for all of the voters for an event 
'''
@task()
def email_voters_vote_url(voters, event):
    email_subject = "Voting Access for Event '" + event.title + "'"

    # Plain text email - this could be replaced for a HTML-based email in the future
    email_body_base = "Please visit the following URL in order to vote on the event '" + event.title + "':\n\n"
    url_base = "http://" + settings.DOMAIN + "/event/" + str(event.pk) + "/poll/1/vote/?key="
    email_body_base = email_body_base + url_base

    duration_info = "\n\nYou can vote between the following dates and times:\n"
    duration_info = duration_info + "Start: " + event.start_time_formatted_utc() + "\n"
    duration_info = duration_info + "End: " + event.end_time_formatted_utc()

    for voter in voters:
        # Generate a key and create an AccessKey object
        key = gen_access_key()
        AccessKey.objects.create(user=voter, event=event, key=key)

        # Update the email body to incl the access key as well as the duration information
        email_body = str(email_body_base + key)
        email_body = email_body + duration_info

        voter.send_email(email_subject, email_body)

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
def event_ended(event):
    # Email all trustees to request their secret keys
    email_trustees_dec(event)

@task()
def gen_event_sk_and_dec(event):
    trustee_sks = TrusteeSK.objects.filter(event=event)
    t_sks_count = len(trustee_sks)

    # Combine SKs if there's more than one
    event_sk = None
    if t_sks_count == 1:
        event_sk = trustee_sks.get().key
    else:
        t_sks_str_list = list()

        for t_sk in trustee_sks:
            t_sks_str_list.append(t_sk.key)

        event_sk = combine_sks(t_sks_str_list)

    EventSK.objects.create(event=event, key=event_sk)

    # With the event sk created, we can decrypt the event
    decrypt_and_tally(event)

@task()
def decrypt_and_tally(event):
    polls = event.polls.all()
    sk = EventSK.objects.filter(event=event).get().key

    for i in range(len(polls)):
        poll = polls[i]
        result = str("")
        result += "{\"name\": \"" + poll.question_text + "\","

        # get num of opts and ballots
        options = poll.options.all()
        opt_count = len(options)
        ballots = Ballot.objects.filter(poll=poll, cast=True)

        result += "\"options\": ["
        for j in range(opt_count):
            # Collect all fragments for this opt
            frags_c1 = list()
            frags_c2 = list()

            for ballot in ballots:
                enc_vote = ballot.encrypted_vote.get()

                if enc_vote is not None:
                    fragments = enc_vote.fragment.all()
                    frags_c1.append(fragments[j].cipher_text_c1)
                    frags_c2.append(fragments[j].cipher_text_c2)

            ciphers = {
                'c1s': frags_c1,
                'c2s': frags_c2
            }

            count = len(frags_c1)
            votes = get_tally(count, ciphers, sk, event.EID)

            result += "{\"option\": \"" + str(options[j].choice_text) + "\", \"votes\": " + str(votes) + "}"

            if j != (opt_count-1):
                result += ","

        result += "]}"

        if i != (len(polls) - 1):
            result += ","

        poll.enc = result
        poll.save()

@task()
def tally_results(event):
    for poll in event.polls.all():
        decs = list()
        for dec in poll.decryptions.all():
            decs.append(dec.text)
        amount = len(decs)
        result = tally(amount, event.EID, decs, poll.enc)

        # TODO: Email organisers using email_user method?

        print(poll.question_text + ": " + result)

@task()
def generate_combpk(event):
    pks = list()

    for tkey in event.trustee_keys.all():
        pks.append(str(tkey.key))

    event.public_key = combpk(pks)

    event.prepared = True
    event.save()

@task
def generate_enc(poll):
    # c1 and c2 components of ciphertexts
    c1s = list()
    c2s = list()

    for ballot in poll.ballots.all():
        if ballot.cast:
            c1s.append(str(ballot.cipher_text_c1))
            c2s.append(str(ballot.cipher_text_c2))

    ciphers = {
        'c1s': c1s,
        'c2s': c2s
    }

    count = len(c1s)

    poll.enc = addec(count, ciphers)
    poll.save()


