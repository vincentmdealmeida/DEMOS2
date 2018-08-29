import json
import urllib2

'''

All functions in this file have been re-implemenented by Vincent de Almeida

Changes include:
    -Update filename to 'crypto_rpc' to reflect the RPC nature of the methods
    -Modified RPC calls that send data to POST requests to avoid large query URLs (using a helper function)
    -Added a new cipher combination and tally function

'''


def send_post_req(url, data):
    data = json.dumps(data)

    # Create a request specifying the Content-Type
    req = urllib2.Request(url, data, {'Content-Type': 'application/json'})
    f = urllib2.urlopen(req)
    response = f.read()
    f.close()

    return response


def param():
    url = 'http://localhost:8080/param'
    jsondict = json.load(urllib2.urlopen(url))
    return json.dumps(jsondict)


def combpk(pks):
    url = 'http://localhost:8080/cmpkstring'

    data = {}
    data['PKs'] = pks

    return send_post_req(url, data)


def add_ciphers(ciphers):
    url = 'http://localhost:8080/add_ciphers'

    data = {}
    data['ciphers'] = ciphers

    return json.loads(send_post_req(url, data))


def get_tally(ballot_cipher, part_decs, group_param, voters_count):
    url = 'http://localhost:8080/get_tally'

    # Construct POST data
    data = {}
    data['ballot_cipher'] = ballot_cipher
    data['part_decs'] = part_decs
    data['param'] = group_param
    data['voters_count'] = voters_count

    return send_post_req(url, data)

