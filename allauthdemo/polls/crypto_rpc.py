import json
import urllib2

'''

All functions in this file have been re-implemenented by Thomas Smith

File then updated by Vincent de Almeida. Changes include:
    -Update filename to 'crypto_rpc' to reflect the RPC nature of the methods
    -Modified RPC calls that send data to POST requests to avoid large query URLs

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


def addec(amount, ciphers):
    url = 'http://localhost:8080/addec'
    querystring = '?number='+str(amount)
    c1s = ciphers['c1s']
    c2s = ciphers['c2s']
    for i, value in enumerate(c1s):
        querystring += "&C1="+str(c1s[i])
        querystring += "&C2="+str(c2s[i])

    print(url+querystring)
    jsondict = json.load(urllib2.urlopen(url+querystring))
    print(json.dumps(jsondict))
    return json.dumps(jsondict)


# Deprecated functionality and has been superseded by get_tally
def tally(amount, group_param, decs, cipher):
    url = 'http://localhost:8080/tally'
    querystring = '?number='+str(amount)
    querystring += '&param='+urllib2.quote(str(group_param))

    for i, value in enumerate(decs):
        querystring += "&decs="+str(value)

    querystring += '&cipher=' + urllib2.quote(str(cipher))

    jsondict = json.load(urllib2.urlopen(url+querystring))

    return str(jsondict['M'])


def combine_sks(sks):
    url = 'http://localhost:8080/comb_sks'

    # Construct POST data
    data = {}
    data['SKs'] = sks

    # Return the new combined SK
    return send_post_req(url, data)


def get_tally(count, ciphers, sk, group_param):
    url = 'http://localhost:8080/get_tally'

    # Construct POST data
    data = {}
    data['count'] = count
    data['ciphers'] = ciphers
    data['sk'] = sk
    data['param'] = group_param

    # Return the tally of votes for the option
    return send_post_req(url, data)

