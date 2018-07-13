from __future__ import absolute_import

import base64
import json
from os import urandom
from celery import task

from django.conf import settings

from allauthdemo.polls.models import AccessKey, Ballot, CombinedBallot, PartialBallotDecryption, EncryptedVote, CombinedEncryptedVote, VoteFragment

from .crypto_rpc import param, combpk, add_ciphers, get_tally

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
    email_trustees_dec - Will email trustees a link to begin decrypting the event
    
'''
def gen_access_key():
    return base64.urlsafe_b64encode(urandom(16)).decode('utf-8')


def email_trustees_dec(event):
    email_subject = "Event Ballot Decryption for '" + event.title + "'"

    # Plain text email - this could be replaced for a HTML-based email in the future
    email_body_base = str("")
    email_body_base += "Dear Trustee,\n\n"
    email_body_base += "You're now required to decrypt the event: " + event.title + \
                       ". This will require uploading your secret key that you have previously backed up.\n\n"
    email_body_base += "Please visit the following URL to submit your trustee secret key to begin event decryption:\n\n"
    url_base = "http://" + settings.DOMAIN + "/event/" + str(event.pk) + "/decrypt/?key="
    email_body_base += url_base

    sign_off = get_email_sign_off()

    for trustee in event.users_trustees.all():
        # Generate a key and create an AccessKey object
        key = gen_access_key()
        AccessKey.objects.create(user=trustee, event=event, key=key)

        email_body = str(email_body_base + key)
        email_body += sign_off

        trustee.send_email(email_subject, email_body)


def get_email_sign_off():
    sign_off = str("")
    sign_off += "\n\nPlease note: This email address is not monitored so please don't reply to this email.\n\n"
    sign_off += "Kind Regards,\n"
    sign_off += "DEMOS 2 Admin - Lancaster University"

    return sign_off


'''
    Combines all of the voter ballots for a poll option into a single 'CombinedBallot'
'''
def combine_ballots(polls):
    for poll in polls:
        options = poll.options.all()
        opt_count = len(options)
        ballots = Ballot.objects.filter(poll=poll)

        for i in range(opt_count):
            option = options[i]

            # Collect all fragments for this opt
            frags_c1 = list()
            frags_c2 = list()

            for ballot in ballots:
                enc_vote = ballot.comb_encrypted_vote.get()

                if enc_vote is not None:
                    fragments = enc_vote.fragment.all()
                    frags_c1.append(fragments[i].cipher_text_c1)
                    frags_c2.append(fragments[i].cipher_text_c2)

            ciphers = {
                'c1s': frags_c1,
                'c2s': frags_c2
            }

            combined_cipher = add_ciphers(ciphers)

            CombinedBallot.objects.create(poll=poll,
                                          option=option,
                                          cipher_text_c1=combined_cipher['C1'],
                                          cipher_text_c2=combined_cipher['C2'])

@task()
def combine_encrypted_votes(voter, poll):
    poll_options_count = poll.options.all().count()
    ballot = Ballot.objects.get_or_create(voter=voter, poll=poll)[0]
    e_votes = EncryptedVote.objects.filter(ballot=ballot)

    CombinedEncryptedVote.objects.filter(ballot=ballot).delete()
    comb_e_vote = CombinedEncryptedVote.objects.create(ballot=ballot)

    for i in range(poll_options_count):
        frags_c1 = list()
        frags_c2 = list()

        for e_vote in e_votes:
            fragments = e_vote.fragment.all()
            frags_c1.append(fragments[i].cipher_text_c1)
            frags_c2.append(fragments[i].cipher_text_c2)

        ciphers = {
            'c1s': frags_c1,
            'c2s': frags_c2
        }

        combined_cipher = add_ciphers(ciphers)
        VoteFragment.objects.create(comb_encrypted_vote=comb_e_vote,
                                    cipher_text_c1=combined_cipher['C1'],
                                    cipher_text_c2=combined_cipher['C2'])

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
    email_body_base = str("")
    email_body_base += "Dear Trustee,\n\n"
    email_body_base += "You have been enrolled as a trustee onto the event: " + event.title + \
                       ". You are required to visit the URL below to generate your secret key and associated public" \
                       " key that will be used to encrypt the event.\n\n You will need to ensure that you back up" \
                       " your secret key as this will be needed to decrypt the event - please don't lose this as it" \
                       " cannot be re-generated. DEMOS2 will never and cannot store your secret key.\n\n"
    email_body_base += "Please visit the following URL to prepare the event and generate your trustee secret key:\n\n"
    url_base = "http://" + settings.DOMAIN + "/event/" + str(event.pk) + "/prepare/?key="
    email_body_base += url_base

    sign_off = get_email_sign_off()

    for trustee in trustees:
        # Generate a key and create an AccessKey object
        key = gen_access_key()
        AccessKey.objects.create(user=trustee, event=event, key=key)

        email_body = str(email_body_base + key)
        email_body += sign_off

        trustee.send_email(email_subject, email_body)


'''
    Emails a URL containing an access key for all of the voters for an event 
'''
@task()
def email_voters_vote_url(voters, event):
    email_subject = "Voting Access for Event '" + event.title + "'"

    # Plain text email - this could be replaced for a HTML-based email in the future
    # TODO: The URL needs updating and it could be replaced with a single UUID that's unique
    # TODO: for the voter for an event which would shorten the URL
    email_body_base = str("")
    email_body_base += "Dear Voter,\n\n"
    email_body_base += "You have been enrolled as a voter onto the event: " + event.title + ".\n\nYou can vote between the following dates and times:\n"
    email_body_base += "Start: " + event.start_time_formatted_utc() + "\n"
    email_body_base += "End:  " + event.end_time_formatted_utc() + "\n\n"
    email_body_base += "Please visit the following URL in order to vote on the event where further instructions can be found on the page:\n\n"
    url_base = "http://" + settings.DOMAIN + "/event/" + str(event.pk) + "/poll/" + str(event.polls.all()[0].uuid) + "/vote/?key="
    email_body_base += url_base

    sign_off = get_email_sign_off()

    for voter in voters:
        # Generate a key and create an AccessKey object
        key = gen_access_key()
        AccessKey.objects.create(user=voter, event=event, key=key)

        # Update the email body to incl the access key as well as the duration information
        email_body = str(email_body_base + key)
        email_body += sign_off

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
    # Combine all the ballots for every option in every poll which will be decrypted by the trustees
    polls = event.polls.all()
    combine_ballots(polls)

    # Email all trustees to request their partial decryptions using their secret keys
    email_trustees_dec(event)


@task()
def generate_combpk(event):
    pks = list()

    for tkey in event.trustee_keys.all():
        pks.append(str(tkey.key))

    event.public_key = combpk(pks)

    event.prepared = True
    event.save()


@task()
def combine_decryptions_and_tally(event):
    polls = event.polls.all()
    polls_count = len(polls)

    for i in range(polls_count):
        poll = polls[i]
        result = str("")
        result += "{\"name\": \"" + poll.question_text + "\","

        options = poll.options.all()
        opt_count = len(options)
        result += "\"options\": ["
        for j in range(opt_count):
            option = options[j]

            # Find the combined ballot for the current option of the current poll
            # and then extract the C1 and C2 components of the cipher that contains the tally
            combined_ballot = CombinedBallot.objects.filter(poll=poll,
                                                            option=option)[0]

            ballot_cipher = {}
            ballot_cipher['C1'] = combined_ballot.cipher_text_c1
            ballot_cipher['C2'] = combined_ballot.cipher_text_c2

            # Collect all the partial decryptions for the ballot cipher which will decrypt the result
            part_decs = PartialBallotDecryption.objects.filter(event=event,
                                                               poll=poll,
                                                               option=option)

            part_decs_text = list()
            for part_dec in part_decs:
                part_decs_text.append(part_dec.text)

            # Get the vote tally for this option and add it to the results
            voters_count = event.voters.all().count()
            votes = get_tally(ballot_cipher, part_decs_text, event.EID, voters_count)
            result += "{\"option\": \"" + str(option.choice_text) + "\", \"votes\": \"" + str(votes) + "\"}"

            if j != (opt_count-1):
                result += ","

        result += "]}"

        if i != (polls_count - 1):
            result += ","

        poll.result_json = result
        poll.save()

