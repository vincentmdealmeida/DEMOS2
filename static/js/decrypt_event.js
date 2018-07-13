//SK checking algorithm - If PK and SK matches, it returns True; otherwise, it returns false.
// Written by Bingsheng Zhang
function skCheck(ctx, params, SK, PK) {
    var D = ctx.PAIR.G1mul(params.g1, SK);
    return D.equals(PK)
}

function validateSKFromString(SKStr) {
    // Re-create the SK from the string byte definition
    let ctx = new CTX("BN254CX");

    let skBytes = SKStr.split(",");
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
    let pkBytes = trustee_pk.split(',').map(function(byteStr) {
        return parseInt(byteStr)
    });

    let pk = new ctx.ECP.fromBytes(pkBytes);

    // Check that the SK supplies generates the PK we know about
    return skCheck(ctx, params, sk, pk);
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

var filesHandleSK = document.getElementById('files_sk_upload');

if(filesHandleSK) {
    filesHandleSK.addEventListener('change', processFileSKChange, false);
}