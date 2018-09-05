var CSRF = $( "input[name='csrfmiddlewaretoken']" ).val();

function csrfSafeMethod(method) {
    // these HTTP methods do not require CSRF protection
    return (/^(GET|HEAD|OPTIONS|TRACE)$/.test(method));
}

function showSetupDialog(titleTxt, bodyTxt) {
    var modalDialog = $('#EventSetupModalDialog');
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

function generateKeys() {
    var parameter = $("#event-param").val();
    var tempParams = JSON.parse(JSON.parse(parameter).crypto);
    //the full objects need to be initalised as per the library, then copy the values we need into it
    //I follow Bingsheng's code as to what objects are used in the parameter object
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

    var PKbytes = [];
    var SKbytes = [];

    var keypair = keyGen(params);
    keypair.PK.toBytes(PKbytes);
    keypair.SK.toBytes(SKbytes);

    var PKB64Encoded = "";
    for(let i = 0; i < PKbytes.length; i++) {
        PKB64Encoded += btoa(PKbytes[i]);
    }

    var SKB64Encoded = "";
    for(let j = 0; j < SKbytes.length; j++) {
        SKB64Encoded += btoa(SKbytes[j]);
    }

    $('input#public-key').val(PKB64Encoded);
    $('input#secret-key').val(SKB64Encoded);

    //mostly code from before here
    var blob = new Blob([SKB64Encoded], {type : 'text/plain'});

    var dlBtn = $('a#download-btn');
    var url = URL.createObjectURL(blob);
    $(dlBtn).attr("href", url);

    let fileName = "sk-" + EVENT_TITLE.replace(/[\W]/g, "-");
    $(dlBtn).attr("download", fileName);
    $(dlBtn).attr("disabled", false);
    $("#public-submit").attr("disabled", false);
}

function onAfterKeySend() {
    showSetupDialog('Public Key Successfully Received',
        'Thank you! You can now close down this page.');
}

function submitPublicKey() {
    $.ajaxSetup({
        beforeSend: function(xhr, settings) {
            if (!csrfSafeMethod(settings.type) && !this.crossDomain) {
                xhr.setRequestHeader("X-CSRFToken", CSRF);
            }
        }
    });

    $.ajax({
         type : "POST",
         url : window.location,
         data : {  public_key: $('input#public-key').val() },
         success : function(){
             onAfterKeySend();
         }
    });
}

$('#EventSetupModalDialog').on('hide.bs.modal', function (e) {
    // Update page to reflect the fact that the PK submission has taken place
    location.reload();
});