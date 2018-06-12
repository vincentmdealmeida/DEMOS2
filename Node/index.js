/*


Code by Thomas Smith


*/

var port = 8080;

var express = require('express');
var Buffer = require('buffer').Buffer;
var CTX = require('milagro-crypto-js')
var app = express();
/*
var cors = require('cors')
app.use(cors());
*/

app.use(express.static('test'));
//default test
app.get('/', function(request, response){

	var data = {
		message: 'hello world',
		value: 5
	}


	//response.send('Hey there'+request.ip);
	response.json(data);
	console.log('request from'+request.ip);

});

//parameter generation function
app.get('/param', function(request, response){
	var param = gpGen();

	console.log('Generated Param:' + param);
	response.json(param);

})

//combine public keys and return the full combined one - JSON Version
app.get('/combpk', function(request, response){

	
	var partials = request.query['PK']
	
	var parsed = [];


	console.log('Combining...');
	for (var i = partials.length - 1; i >= 0; i--) {
		console.log('PK' +i+ ':    '+partials[i]);
		parsed.push(JSON.parse(partials[i]));
	}

	var PK = combine(parsed);
	response.json(PK);

})


//byte array version
app.get('/cmpkstring', function(request, response){
    var ctx = new CTX("BN254CX");

	var partials = request.query['PK']
    //if there is only one key, partials will be an array of the individual bytes
    //if more than one, it will be an array of arrays
    //we need to factor for this in code
	var noOfKeys = request.query['number'];
	var parsed = [];
    
    if(noOfKeys == partials.length)//if we're submitting more than one key
    {
        console.log('Combining' + noOfKeys + " keys...");
        for (var i = partials.length - 1; i >= 0; i--) {
        console.log('PK' +i+ ':    '+partials[i]);
        var bytes = Buffer.from(partials[i].split(','), 'hex');
        console.log(bytes)
        var pk = new ctx.ECP.fromBytes(bytes);
        parsed.push(pk);
        }
    }
    else if(noOfKeys == 1)
    {
        console.log("Combining just one key");
        var bytes = Buffer.from(partials.split(','), 'hex');
        console.log(bytes);
        var pk = new ctx.ECP.fromBytes(bytes);
        parsed.push(pk);
    }
	
	response.json(combine(parsed));
})


//addition function on homomorphically encrypted variables
//this may need some work, different method of serialisation maybe?
app.get('/addec', function(request, response){
	var c1 = request.query['C1'];
	var c2 = request.query['C2'];
    var number = request.query['number']; //number of ciphertexts to add
	//all the list of ciphertext objects to give to the function
	var parsed = [];

	var ctx = new CTX("BN254CX");
	console.log('Addec:');

    if(number == c1.length)
    {
        for (var i = 0; i < c1.length; i++) {
            console.log(i + ".C1:   " + c1[i]);
            var c1Bytes = Buffer.from(c1[i].split(','), 'hex');
            var newC1 = new ctx.ECP.fromBytes(c1Bytes);
            
            var cipher =
            {
                C1:newC1,
                C2:null
            };
        parsed.push(cipher);
        
        }

        for (var j = 0; j < c2.length; j++) {
            console.log(j + ".C2:   " + c2[j]);
            var c2Bytes = Buffer.from(c2[j].split(','), 'hex');
            var newC2 = new ctx.ECP.fromBytes(c2Bytes);
           
            parsed[j].C2 = newC2;
        }         
    }

    else if(number == 1)
    {
        console.log("only one cipher");    
        var c1Bytes = Buffer.from(c1.split(','), 'hex');
        var newC1 = new ctx.ECP.fromBytes(c1Bytes);
        console.log("C1:   " + c1);
        var c2Bytes = Buffer.from(c2.split(','), 'hex');
        var newC2 = new ctx.ECP.fromBytes(c2Bytes);
        console.log("C2:   " + c2);

        var cipher =
        {
            C1:newC1,
            C2:newC2
        };
        parsed.push(cipher);
    }


	response.json(add(parsed));
})



//tally partially decrypted ciphertexts
app.get('/tally', function(request, response){
    console.log("called tally");
    var amount = request.query['number'];//number of decryptions taking in
    var paramString = request.query['param'];//event group parameter in JSON
    var partialsStrings = request.query['decs'];//array of partial decryption(s) in bytes
    var ciphertextString = request.query['cipher'];//ciphertext being decrypted in JSON

    //re-build parameters
    var tempParams = JSON.parse(paramString);
    var ctx = new CTX("BN254CX"); //new context we can use
    var n = new ctx.BIG();
    var g1 = new ctx.ECP();
    var g2 = new ctx.ECP2();

    //copying the values 
    n.copy(tempParams.n);
    g1.copy(tempParams.g1);
    g2.copy(tempParams.g2);

    var params = {
      n:n,
      g1:g1,
      g2:g2
    }

    //re-build partial decryptions
    var partials = []
    if(amount == partialsStrings.length)
    {
        console.log(amount + " partial decryptions");
        for(var i = 0; i < partialsStrings.length; i++)
        {
            var bytes = Buffer.from(partialsStrings[i].split(','), 'hex');
            var dec = {
                D:new ctx.ECP.fromBytes(bytes)
            }
            partials.push(dec);
        }
    }
    else if(amount == 1)
    {
        console.log("Only one partial decryption received")
        console.log(paramString)
        var bytes = Buffer.from(partialsStrings.split(','), 'hex');
        var dec = {
            D:new ctx.ECP.fromBytes(bytes)
        }
        partials.push(dec);
    }

    //re-build combined ciphertext
    var tempCipher = JSON.parse(ciphertextString);

    cipher = {
        C1: new ctx.ECP(),
        C2: new ctx.ECP()
    }
    cipher.C1.copy(tempCipher.C1);
    cipher.C2.copy(tempCipher.C2);

    response.json(tally(params, partials, cipher))
})



var server = app.listen(port, function(){
	var host = server.address().address;
	var appPort = server.address().port;

	console.log('Server listening on ' + host + ':'+ port);
});


/*

Cryptography functions written by Bingsheng Zhang

Uses the milagro-crypto-js library at: 
https://github.com/milagro-crypto/milagro-crypto-js

*/


//Group parameter generator: returns rng object and generators g1,g2 for G1,G2 as well as order
gpGen = function(){
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
}


//creates ElGamal public and secret key
keyGen=function(params){        
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
}


//combine multiple public key together
//the input is an array of PKs
combine=function(PKs){        
        var ctx = new CTX("BN254CX");  
        var pk=new ctx.ECP();      
        //copy the first pk
        pk.copy(PKs[0]);
        //multiple the rest PKs
        for(i=1;i<PKs.length;i++){
            pk.add(PKs[i]);
        }       
        
        return{
            PK:pk
        }
}

        
//ElGamal encryption
encrypt=function(params,PK, m){
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
}


//add ciphertexts
add=function(Ciphers){        
        var ctx = new CTX("BN254CX");  
        var s1=new ctx.ECP();
        var s2=new ctx.ECP();
        //copy the first cipher
        s1.copy(Ciphers[0].C1);
        s2.copy(Ciphers[0].C2);
        //multiple the rest ciphertexts
        for(i=1;i<Ciphers.length;i++){
            s1.add(Ciphers[i].C1);
        }       
        //no idea why I need two loops
        for(j=1;j<Ciphers.length;j++){
            s2.add(Ciphers[j].C2);
        }

        return{
            C1:s1,
            C2:s2
        }
}


//ElGamal decryption
decrypt=function(params,SK, C){
        var ctx = new CTX("BN254CX");  
        var D=new ctx.ECP();
        D = ctx.PAIR.G1mul(C.C1,SK);

        var gM=new ctx.ECP();
        gM.copy(C.C2);        
        gM.sub(D);

//search for message by brute force
        var B;       
        for (j = 0; j < 1000; j++) {
            //use D as temp var
            B = new ctx.BIG(j);
            D = ctx.PAIR.G1mul(params.g1,B);
            if (D.equals(gM))
                return{
                    M:j
                }

        };
 
        
        return{
            M: "Error"
        }
}




//ElGamal partial decryption
partDec=function(SK, C){
        var ctx = new CTX("BN254CX");  
        var D=new ctx.ECP();
        D = ctx.PAIR.G1mul(C.C1,SK);
        
        return{
            D: D
        }
}




//Tally, combine partial decryption 
//Ds is the array of partial decryptions; C is the ciphertext.
tally=function(params,Ds, C){
        var ctx = new CTX("BN254CX");  
        var D=new ctx.ECP();
        D.copy(Ds[0].D);

        //combine D
        for(i=1;i<Ds.length;i++){
            D.add(Ds[i].D);
        }        


        var gM=new ctx.ECP();
        gM.copy(C.C2);        
        gM.sub(D);

//search for message by brute force
        var B;       
        for (j = 0; j < 1000; j++) {
            //use D as temp var
            B = new ctx.BIG(j);
            D = ctx.PAIR.G1mul(params.g1,B);
            if (D.equals(gM))
                return{
                    M:j
                }

        };
 
        
        return{
            M: "Error"
        }
}



