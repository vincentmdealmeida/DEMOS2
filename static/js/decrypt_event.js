// -------------- Global vars --------------------
var filesHandleSK = document.getElementById('files_sk_upload');
var CSRF = $( "input[name='csrfmiddlewaretoken']" ).val();

// -------------- Helper fns --------------------
//SK checking algorithm - If PK and SK matches, it returns True; otherwise, it returns false.
// Written by Bingsheng Zhang
function skCheck(ctx, params, SK, PK) {
    var D = ctx.PAIR.G1mul(params.g1, SK);
    return D.equals(PK)
}

function csrfSafeMethod(method) {
    // these HTTP methods do not require CSRF protection
    return (/^(GET|HEAD|OPTIONS|TRACE)$/.test(method));
}

function getKeyBytes(key, byteArray) {
    for(let i = 0; i < key.length; i += 4) {
        let B64EncodedByte = key.substring(i, i + 4);

        byteArray.push(atob(B64EncodedByte));
    }
}

function showDialog(titleTxt, bodyTxt) {
    var modalDialog = $('#modalDialog');
    var title = modalDialog.find('.modal-title');
    var body = modalDialog.find('.modal-body');

    title.text(titleTxt);
    var bodyText = bodyTxt;

    var p = document.createElement("p");
    p.innerHTML = bodyText;
    body.empty();
    body.append( p );

    modalDialog.modal('show');
}

// -----------------------------------------------

function validateSKFromString(SKStr) {
    // Re-create the SK from the string byte definition
    let ctx = new CTX("BN254CX");

    // Check that the length is valid, otherwise display an error
    if(!(SKStr.length % 4 === 0)) {
        showDialog('Error',
            'The length of the supplied secret key appears to be invalid. Check and try again.');
    }

    let skBytes = [];
    getKeyBytes(SKStr, skBytes);
    let sk = new ctx.BIG.fromBytes(skBytes);

    // Re-create the params
    let n = new ctx.BIG();
    let g1 = new ctx.ECP();
    let g2 = new ctx.ECP2();

    n.copy(tempParams.n);
    g1.copy(tempParams.g1);
    g2.copy(tempParams.g2);

    let params = {
      n:n,
      g1:g1,
      g2:g2
    };

    // Re-create the trustee PK from the string byte definition
    let pkBytes = [];
    getKeyBytes(trustee_pk, pkBytes);
    let pk = new ctx.ECP.fromBytes(pkBytes);

    // Check that the SK supplies generates the PK we know about
    return skCheck(ctx, params, sk, pk);
}

function decryptSubmitCiphers() {
    var skString = $('#secret-key').val();

    if (!skString) {
        showDialog('Error', 'You haven\'t supplied your secret key. Please go back and upload this from file.');
    }
    else {
        // Rebuild the trustee's secret key
        var ctx = new CTX("BN254CX");
        var skBytes = [];
        getKeyBytes(skString, skBytes);
        var sk = new ctx.BIG.fromBytes(skBytes);

        var inputs = $("form input[type=text]");

        inputs.each(function() { //for each ciphertext to decrypt
          let input = $(this);
          console.log(input.attr('name'));

          var ciphertext = {
              C1: null,
              C2: null
          };

          var temp = JSON.parse(input.val());
          var c1Bytes = getBytes(temp.C1.split(','));
          ciphertext.C1 = new ctx.ECP.fromBytes(c1Bytes);

          var c2Bytes = getBytes(temp.C2.split(','));
          ciphertext.C2 = new ctx.ECP.fromBytes(c2Bytes);

          // Perform partial decryption where the method returns an object containing an ECP()
          var partial = partDec(sk, ciphertext);

          var bytes = [];
          partial.D.toBytes(bytes);
          input.val(bytes.toString());
        });
    }
}

function processFileSKChange(event) {
    var files = event.target.files;

    if(files !== undefined
        && files[0] !== undefined) {
        var reader = new FileReader();

        reader.onload = function(e) {
            var SKStr = reader.result;

            // Check that the SK string is not blank
            if(SKStr === '') {
                // Show a dialog informing the user that they've uploaded a blank file
                showDialog('Error', 'The file you have uploaded is blank.');
            }

            const valid = validateSKFromString(SKStr);

            if(valid) {
                $('input#secret-key').val(SKStr);
            } else {
                // Show a dialog informing the user that they've supplied an invalid SK
                showDialog('Error',
                    'The secret key you have supplied is invalid and doesn\'t match with the recorded public key.');
            }
        };

        reader.readAsText(files[0]);
    }
}

if(filesHandleSK) {
    filesHandleSK.addEventListener('change', processFileSKChange, false);
}