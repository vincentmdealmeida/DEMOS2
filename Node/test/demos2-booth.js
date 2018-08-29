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

