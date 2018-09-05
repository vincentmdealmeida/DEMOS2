/*


Code by Bingsheng Zhang, Thomas Smith, Vincent de Almeida

Dependencies can be found in 'package.json' and installed using 'npm install'

*/

var port = 8080;

var Buffer = require('buffer').Buffer;
var atob = require("atob");
var CTX = require('milagro-crypto-js');

var express = require('express');
var bodyParser = require("body-parser");
var app = express();

// Express server configuration
app.use(express.static('test'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

//default test
app.get('/', function(request, response){

	var data = {
		message: 'hello world',
		value: 5
	};


	//response.send('Hey there'+request.ip);
	response.json(data);
	console.log('request from'+request.ip);

});

//parameter generation function
app.get('/param', function(request, response){
	var param = gpGen();

	console.log('Generated Group Param');
	response.json(param);

});

//combine public keys and return the full combined one - JSON Version
app.get('/combpk', function(request, response){
    console.log('\nEndpoint /combpk called');
	
	var partials = request.query['PK'];
	
	var parsed = [];


	console.log('Combining...');
	for (var i = partials.length - 1; i >= 0; i--) {
		console.log('PK' +i+ ':    '+partials[i]);
		parsed.push(JSON.parse(partials[i]));
	}

	var PK = combine_pks(parsed);
	response.json(PK);

});

function getKeyBytes(key, byteArray) {
    for(let i = 0; i < key.length; i += 4) {
        let B64EncodedByte = key.substring(i, i + 4);

        byteArray.push(atob(B64EncodedByte));
    }
}

//byte array version
app.post('/cmpkstring', function(request, response){
    console.log('\nEndpoint /cmpkstring called');
    var ctx = new CTX("BN254CX");

	var partials = request.body.PKs;
	var parsed = [];
    
    if(partials.length > 1)//if we're submitting more than one key
    {
        console.log('Combining ' + partials.length + " public keys into one...");
        for (let i = partials.length - 1; i >= 0; i--) {
            console.log('PK' + i + ':   ' + partials[i]);

            let rawBytes = [];
            getKeyBytes(partials[i], rawBytes);

            parsed.push(new ctx.ECP.fromBytes(Buffer.from(rawBytes, 'hex')));
        }
    }
    else if(partials.length === 1)
    {
        console.log("Combining just one public key...");
        let PKStr = partials[0];
        console.log("PK:    " + PKStr);

        let rawBytes = [];
        getKeyBytes(PKStr, rawBytes);

        parsed.push(new ctx.ECP.fromBytes(Buffer.from(rawBytes, 'hex')));
    }
	
	response.json(combine_pks(parsed));
});


//addition function on homomorphically encrypted variables
//this may need some work, different method of serialisation maybe?
app.post('/add_ciphers', function(request, response){
	console.log("\nEndpoint /add_ciphers called");
    const C1s = request.body.ciphers.c1s;
	const C2s = request.body.ciphers.c2s;
	const CIPHER_COUNT = C1s.length;

	// Will store a list of parsed ciphers from the C1s and C2s arrays passed in
	var parsedCiphers = [];
	var ctx = new CTX("BN254CX");

    if(CIPHER_COUNT > 1)
    {
        console.log("Combining " + CIPHER_COUNT + " ciphers");

        for (var i = 0; i < CIPHER_COUNT; i++) {

            var c1Bytes = Buffer.from(C1s[i].split(','), 'hex');
            var newC1 = new ctx.ECP.fromBytes(c1Bytes);

            var c2Bytes = Buffer.from(C2s[i].split(','), 'hex');
            var newC2 = new ctx.ECP.fromBytes(c2Bytes);
            
            var cipher = {
                C1 : newC1,
                C2 : newC2
            };

            parsedCiphers.push(cipher);
        }

    } else if(CIPHER_COUNT === 1) {
        console.log("Combining only one cipher");

        var c1Bytes = Buffer.from(C1s[0].split(','), 'hex');
        var newC1 = new ctx.ECP.fromBytes(c1Bytes);


        var c2Bytes = Buffer.from(C2s[0].split(','), 'hex');
        var newC2 = new ctx.ECP.fromBytes(c2Bytes);

        var cipher =
        {
            C1 : newC1,
            C2 : newC2
        };

        parsedCiphers.push(cipher);
    }

    // Combine the ciphers here
    var combinedCipher = add(parsedCiphers);

    // Get the byte string of the C1 and C2 part for transmission
    var C1Bytes = [];
    combinedCipher.C1.toBytes(C1Bytes);

    var C2Bytes = [];
    combinedCipher.C2.toBytes(C2Bytes);

    var responseData = {
        C1: C1Bytes.toString(),
        C2: C2Bytes.toString()
    };

	response.json(responseData);
});

app.post('/get_tally', function(request, response){
    console.log("\nEndpoint /get_tally called");

    // Extract the data from the request
    const TEMP_PARAMS = JSON.parse(JSON.parse(request.body.param).crypto);
    const BALLOT_CIPHER = request.body.ballot_cipher;
    const PART_DECS = request.body.part_decs;
    const VOTERS_COUNT = request.body.voters_count;

    // Re-build parameters
    var ctx = new CTX("BN254CX");
    var n = new ctx.BIG();
    var g1 = new ctx.ECP();
    var g2 = new ctx.ECP2();

    n.copy(TEMP_PARAMS.n);
    g1.copy(TEMP_PARAMS.g1);
    g2.copy(TEMP_PARAMS.g2);

    var params = {
        n : n,
        g1 : g1,
        g2 : g2
    };

    // Initialise the ballot cipher
    var c1Bytes = Buffer.from(BALLOT_CIPHER.C1.split(','), 'hex');
    var newC1 = new ctx.ECP.fromBytes(c1Bytes);

    var c2Bytes = Buffer.from(BALLOT_CIPHER.C2.split(','), 'hex');
    var newC2 = new ctx.ECP.fromBytes(c2Bytes);

    var cipher =
    {
        C1 : newC1,
        C2 : newC2
    };

    // Initialise all of the partial decryptions
    var partials = [];
    for(var i = 0; i < PART_DECS.length; i++)
    {
        var bytes = Buffer.from(PART_DECS[i].split(','), 'hex');

        var dec = {
            D : new ctx.ECP.fromBytes(bytes)
        };

        partials.push(dec);
    }

    // Send the decrypted cipher value (vote tally for an option)
    response.send("" + getCipherVal(params, partials, cipher, VOTERS_COUNT).M);
});

var server = app.listen(port, 'localhost', function(){
	var host = server.address().address;
	var appPort = server.address().port;

	console.log('Server listening on ' + host + ' on port '+ appPort);
});


/*

Cryptography functions written by Bingsheng Zhang

Uses the milagro-crypto-js library at: 
https://github.com/milagro-crypto/milagro-crypto-js

*/


//Group parameter generator: returns rng object and generators g1,g2 for G1,G2 as well as order
gpGen = function() {
        //init, and base generators
        var ctx = new CTX("BN254CX");

        var n=new ctx.BIG(0); n.rcopy(ctx.ROM_CURVE.CURVE_Order);

        //get generator P for G1
            P = new ctx.ECP(0);
            gx = new ctx.BIG(0);
            gx.rcopy(ctx.ROM_CURVE.CURVE_Gx);
            if (ctx.ECP.CURVETYPE != ctx.ECP.MONTGOMERY) {
                gy = new ctx.BIG(0);
                gy.rcopy(ctx.ROM_CURVE.CURVE_Gy);
                P.setxy(gx, gy);
            } else P.setx(gx);
        
        //get generator Q for G2
        var A=new ctx.BIG(0); 
        var B=new ctx.BIG(0); 
        A.rcopy(ctx.ROM_CURVE.CURVE_Pxa);
        B.rcopy(ctx.ROM_CURVE.CURVE_Pxb);
        var Qx=new ctx.FP2(0); Qx.bset(A,B);
        A.rcopy(ctx.ROM_CURVE.CURVE_Pya); 
        B.rcopy(ctx.ROM_CURVE.CURVE_Pyb);
        var Qy=new ctx.FP2(0); Qy.bset(A,B);
        var Q=new ctx.ECP2();
        Q.setxy(Qy,Qy);

        return{
            n:n,
            g1:P,
            g2:Q
        }    
};


//creates ElGamal public and secret key
keyGen = function(params) {
        var ctx = new CTX("BN254CX");  
        //set rng
        var RAW = [];
        var d = new Date();//time for seed, not secure
        var rng = new ctx.RAND();
        rng.clean();
        RAW[0] = d.getSeconds();
        RAW[1] = d.getMinutes();
        RAW[2] = d.getMilliseconds();
        rng.seed(3, RAW);

        //ElGamal
        var sk = new ctx.BIG(0); 
        sk = ctx.BIG.randomnum(params.n,rng);
        var pk = new ctx.ECP(0);
        pk = ctx.PAIR.G1mul(params.g1,sk);
        
        
        return{
            PK:pk,
            SK:sk
        }
};


//combine multiple public key together
//the input is an array of PKs
combine_pks = function(PKs) {
        var ctx = new CTX("BN254CX");  
        var pk=new ctx.ECP();      
        //copy the first pk
        pk.copy(PKs[0]);
        //multiple the rest PKs
        for(i=1;i<PKs.length;i++){
            pk.add(PKs[i]);
        }       
        
        return {
            PK : pk
        }
};

// Written by Vincent de Almeida: Combines multiple secret keys together
// The SKs in the SKs array should already have been initialised using 'new ctx.BIG.fromBytes()'
combine_sks = function(SKs) {
    // 'add' the rest of the sks to the first
    var sk = SKs[0];

    for(var i = 1; i < SKs.length; i++) {
        sk.add(SKs[i]);
    }

    return {
        SK: sk
    }
};
        
//ElGamal encryption
encrypt = function(params,PK, m) {
        var ctx = new CTX("BN254CX");  
        //set rand
        var RAW = [];
        var d = new Date();//time for seed, not secure
        var rng = new ctx.RAND();
        rng.clean();
        RAW[0] = d.getSeconds();
        RAW[1] = d.getMinutes();
        RAW[2] = d.getMilliseconds();
        rng.seed(3, RAW);

        var r=new ctx.BIG.randomnum(params.n,rng);
        var M=new ctx.BIG(m);

        var C1=new ctx.ECP();
        C1 = ctx.PAIR.G1mul(params.g1,r);
        
        var gM=new ctx.ECP();
        gM = ctx.PAIR.G1mul(params.g1,M);

        var C2=new ctx.ECP();
        C2 = ctx.PAIR.G1mul(PK,r);
        C2.mul(r);
        C2.add(gM);
        
        return{
            C1:C1,
            C2:C2
        }
};


//add ciphertexts
add = function(Ciphers) {
        var ctx = new CTX("BN254CX");  
        var s1 = new ctx.ECP();
        var s2 = new ctx.ECP();

        //copy the first cipher
        s1.copy(Ciphers[0].C1);
        s2.copy(Ciphers[0].C2);

        //multiple the rest ciphertexts
        for(var i = 1; i < Ciphers.length; i++){
            s1.add(Ciphers[i].C1);
            s2.add(Ciphers[i].C2);
        }

        return {
            C1 : s1,
            C2 : s2
        }
};


//ElGamal decryption
decrypt = function(params,SK, C, votersCount) {
        var ctx = new CTX("BN254CX");  
        var D=new ctx.ECP();
        D = ctx.PAIR.G1mul(C.C1,SK);

        var gM=new ctx.ECP();
        gM.copy(C.C2);        
        gM.sub(D);

        // Search for value based on the number of voters
        var B;       
        for (var j = 0; j <= votersCount; j++) {
            //use D as temp var
            B = new ctx.BIG(j);
            D = ctx.PAIR.G1mul(params.g1,B);
            if (D.equals(gM))
                return{
                    M:j
                }

        }
        
        return{
            M: "Error"
        }
};


//ElGamal partial decryption
partDec = function(SK, C) {
        var ctx = new CTX("BN254CX");  
        var D = new ctx.ECP();
        D = ctx.PAIR.G1mul(C.C1,SK);
        
        return {
            D: D
        }
};



// Combines partial decryptions to enable the decryption of a cipher text which will be an int val representing
// a tally of votes for an option. Ds is the array of partial decryptions; C is the ciphertext.
getCipherVal = function(params, Ds, C, votersCount) {
        // Create a context and initialise the first decryption part
        var ctx = new CTX("BN254CX");
        var D = new ctx.ECP();
        D.copy(Ds[0].D);

        // Combine the decryptions (in Ds array) into a single decryption by adding them to D
        for(var i = 1; i < Ds.length; i++){
            D.add(Ds[i].D);
        }        


        var gM=new ctx.ECP();
        gM.copy(C.C2);        
        gM.sub(D);

        // Search for the value based on the number of voters
        var B;       
        for (var j = 0; j <= votersCount; j++) {
            //use D as temp var
            B = new ctx.BIG(j);
            D = ctx.PAIR.G1mul(params.g1,B);
            if (D.equals(gM))
                return{
                    M: j
                }

        }
 
        // If the search failed
        return{
            M: "Error"
        }
};



