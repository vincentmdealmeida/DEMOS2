import os
import shlex
import subprocess
import json
import urllib2

'''

All functions in this file have been re-implemenented by Thomas Smith

File then updated by Vincent de Almeida. Changes include:
    -Update filename to 'crypto_rpc' to reflect the RPC nature of the methods

'''
def param():
    url = 'http://localhost:8080/param' # RPC URL
    jsondict = json.load(urllib2.urlopen(url))
    return json.dumps(jsondict)

def combpk(amount, pks):
    url = 'http://localhost:8080/cmpkstring' # RPC URL
    querystring = '?number='+str(amount)
    for pk in pks:
        querystring += '&PK='+pk

    print(url+querystring)
    jsondict = json.load(urllib2.urlopen(url+querystring))
    print(json.dumps(jsondict))
    return json.dumps(jsondict)

def addec(amount, ciphers):
    url = 'http://localhost:8080/addec' # RPC URL
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

def tally(amount, param, decs, cipher):
    url = 'http://localhost:8080/tally' # RPC URL
    querystring = '?number='+str(amount)
    querystring += '&param='+urllib2.quote(str(param))

    testquerystring = '?number='+str(amount)
    testquerystring += '&param='+str(param)

    for i, value in enumerate(decs):
        querystring += "&decs="+str(value)
        testquerystring += "&decs="+str(value)

    querystring += '&cipher=' + urllib2.quote(str(cipher))
    testquerystring += '&cipher=' + str(cipher)

    print(url+querystring)
    print(url+testquerystring)
    jsondict = json.load(urllib2.urlopen(url+querystring))
    print('tally: ' + str(jsondict['M']))
    return str(jsondict['M'])