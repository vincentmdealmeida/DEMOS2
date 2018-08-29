var dialogOpen = false;

function showDialogWithText(titleTxt, bodyTxt) {
    var modalDialog = $('#modalDialog');
    var title = modalDialog.find('.modal-title');
    var body = modalDialog.find('.modal-body');

    title.text(titleTxt);

    var p = document.createElement("p");
    p.innerHTML = bodyTxt;
    body.empty();
    body.append( p );

    if(!dialogOpen) {
        modalDialog.modal('toggle');
        dialogOpen = true;
    }
}

// This should stop people ticking more than the maximum permitted
function updateCheckboxInteractivity() {
    var inputs = $("label input[type=checkbox]");

    if(selectedCount === MAX_SELECTIONS) {
        inputs.each(function() {
            var input = $(this);

            if(!input.prop('checked')){
                input.prop('disabled', true);
            }
        });
    } else {
        inputs.each(function() {
            var input = $(this);

            if(!input.prop('checked')) {
                input.prop('disabled', false);
            }
        });
    }
}

$("label input[type=checkbox]").change(function() {
    // Increment the selectedCount counter if a box has been checked
    if(this.checked) {
        selectedCount += 1;
    } else {
        selectedCount -= 1;

        // Just incase this falls below zero to avoid any nasty bugs
        if(selectedCount < 0) {
            selectedCount = 0;
        }
    }

    updateCheckboxInteractivity();
});

function isVotingInputValid() {
    var valid = true;

    // First establish if the user's selection count is valid
    if(!(selectedCount >= MIN_SELECTIONS && selectedCount <= MAX_SELECTIONS)) {
        valid = false;
    }

    if(selectedCount < MAX_SELECTIONS) {
        valid = false;
    }

    // This will highlight when people haven't selected enough options

    if(!valid) {
        let errText = "You've only selected " + selectedCount;

        if(selectedCount > 1) {
            errText += " options.";
        } else {
            errText = " You haven't selected any options.";
        }

        errText += " The minimum number you need to select is " + MIN_SELECTIONS + " and the maximum is "
            + MAX_SELECTIONS + ". Please go back and correct this.";

        let titleTxt = 'Voting Error';

        showDialogWithText(titleTxt, errText);
        return;
    }

    return valid;
}

var progressBar = document.getElementById("progress-bar");

$('#gen-ballots-btn').click(function() {
    // Ensure that the user selections are valid
    if(isVotingInputValid()) {
        // Hide the button
        $(this).toggleClass('hidden');

        // Inject the description progress bar which can then be updated by the encrypt btn
        $('#progress-bar-description').toggleClass('hidden');
        $('#progress-bar-container').toggleClass('hidden');

        setTimeout(generateBallots, 25);
    }
});

// Based on the user's vote in the current poll, this generates a ballot which
// does not leak information about how many options the user has selected
function generateBallot() {
    // Elliptic curve cryptography params used for encryption of encrypted vote
    // fragments
    var ctx = new CTX("BN254CX");
    var n = new ctx.BIG();
    var g1 = new ctx.ECP();
    var g2 = new ctx.ECP2();

    var parameter = $('#event-param').val();
    var tempParams = JSON.parse(JSON.parse(parameter).crypto);

    //copying the values
    n.copy(tempParams.n);
    g1.copy(tempParams.g1);
    g2.copy(tempParams.g2);

    var params = {
      n:n,
      g1:g1,
      g2:g2
    };

    var tempPK = JSON.parse($('#comb_pk').val());
    var pk = new ctx.ECP(0);
    pk.copy(tempPK.PK);

    // Collect together the unencrypted votes (which correspond to selected options)
    var checkboxInputs = $("label input[type=checkbox]");
    var unencryptedVotes = [];
    checkboxInputs.each(function() {
        var checkbox = $(this);

        // Push the selected option values (ones that have been checked) to an array
        if(checkbox.prop('checked')) {
            unencryptedVotes.push(checkbox.val());
        }
    });

    // If there is a dif between the num selected and the max allowed, push blank votes to the array to pad this
    // to prevent information leakage
    if(unencryptedVotes.length < MAX_SELECTIONS) {
        let blankVotesToPush = MAX_SELECTIONS - unencryptedVotes.length;

        for(let i = 0; i < blankVotesToPush; i++) {
            unencryptedVotes.push(genBlankVote());
        }
    }

    // Encrypt all of the votes for this ballot
    var encryptedVotes = [];
    unencryptedVotes.forEach(function(unencryptedVote) {
        var encFragments = [];

        // Encrypt each fragment of the unencrypted vote
        unencryptedVote.split(',').forEach(function(fragment) {
            var cipher = encrypt(params, pk, parseInt(fragment));

            // Store C1, C2 and r from the cipher in the fragment
            var c1Bytes = [];
            cipher.C1.toBytes(c1Bytes);

            var c2Bytes = [];
            cipher.C2.toBytes(c2Bytes);

            var rBytes = [];
            cipher.r.toBytes(rBytes);

            encFragments.push({
                C1 : c1Bytes.toString(),
                C2 : c2Bytes.toString(),
                r : rBytes.toString()
            });
        });

        // Store all fragments in a single 'encrypted vote'
        encryptedVotes.push({
            fragments: encFragments
        });
    });

    return {
        encryptedVotes: encryptedVotes
    };
}

// Generates a blank vote as a string using the binary encoding scheme
function genBlankVote() {
    var vote = "";

    for(var i = 0; i < OPTION_COUNT; i++) {
        vote += "0";

        if (i !== (OPTION_COUNT - 1)) {
            vote += ",";
        }
    }
  
    return vote;
}

var CSRF = $( "input[name='csrfmiddlewaretoken']" ).val();
function csrfSafeMethod(method) {
    // these HTTP methods do not require CSRF protection
    return (/^(GET|HEAD|OPTIONS|TRACE)$/.test(method));
}

var bytestostring = function(b) {
    var s = "";
    var len = b.length;
    var ch;
    for (var i = 0; i < len; i++) {
        ch = b[i];
        s += ((ch >>> 4) & 15).toString(16);
        s += (ch & 15).toString(16);
    }
    return s;
};

var stringtobytes = function(s) {
    var b = [];
    for (var i = 0; i < s.length; i++) {
        b.push(s.charCodeAt(i));
    }
    return b;
};

function SHA256Hash(bytes, toStr) {
    var ctx = new CTX();

    var R = [];
    var H = new ctx.HASH256();

    H.process_array(bytes);
    R = H.hash();

    if (R.length === 0) {
        return null;
    }

    if(toStr) {
        // If toStr is true we return the stringified version of the bytes of the hash
        return bytestostring(R);
    } else {
        // If toStr is false we return the bytes of the hash
        return R;
    }
}

function generateBallots() {
    // Generate Ballot A and Ballot B to be displayed to the user
    // This fn starts the process
    var ballotA = generateBallot();

    // Update the progress bar once the generation has completed
    progressBar.setAttribute("style", "width: 50%;");

    // This delay allows the execution thread to update the above CSS on the progress bar
    setTimeout(function () {
        var ballotB = generateBallot();
        progressBar.setAttribute("style", "width: 100%;");

        showFirstQRCode(ballotA, ballotB);
    }, 150);
}

function showFirstQRCode(ballotA, ballotB) {
    var ballots = new Array(ballotA, ballotB);
    var ballotHashes = new Array(2);

    // Hash both ballots and store
    for (let i = 0; i <= 1; i++)
        ballotHashes[i] = SHA256Hash(stringtobytes(JSON.stringify(ballots[i])), true);

    // With the ballots and their hashes generated, we can display the QR code of both hashes
    var modalDialog = $('#modalDialog');
    var title = modalDialog.find('.modal-title');
    var body = modalDialog.find('.modal-body');
    var footer = modalDialog.find('.modal-footer');

    body.empty();
    title.text('Please Scan this QR Code');

    var QRCodeImg = document.createElement('img');
    QRCodeImg.setAttribute('class', 'QR-code');
    new QRCode(QRCodeImg, ballotHashes[0] + ';' + ballotHashes[1]);

    // ----------------------------------------------

    var hashGroupDiv = document.createElement('div');
    var br = document.createElement('br');
    hashGroupDiv.append( br );

    var hashA = document.createElement("span");
    hashA.innerHTML = "Hash A: " + ballotHashes[0];
    hashGroupDiv.append( hashA );

    var br2 = document.createElement('br');
    hashGroupDiv.append( br2 );

    var hashB = document.createElement("span");
    hashB.innerHTML = "Hash B: " + ballotHashes[1];
    hashGroupDiv.append( hashB );

    // -----------------------------------------------

    body.append(QRCodeImg);
    body.append(hashGroupDiv);

    var closeButton = $('close-button');
    closeButton.removeClass('btn-success');
    closeButton.addClass('btn-danger');
    closeButton.text("Close without submitting vote");

    var nextButton = document.createElement('button');
    nextButton.setAttribute('type', 'button');
    nextButton.setAttribute('id', 'next-button');
    nextButton.setAttribute('class', 'btn btn-default');
    nextButton.innerHTML = "Next";

    footer.prepend(nextButton);

    modalDialog.modal('show');

    $('#next-button').click(function(e) {
        showBallotChoiceDialog(ballots);
    });
}

function showBallotChoiceDialog(ballots) {
    // Display the ballot choice dialog
    var modalDialog = $('#modalDialog');
    var title = modalDialog.find('.modal-title');
    var body = modalDialog.find('.modal-body');

    body.empty();
    title.text('Please Select a Ballot');

    // Generate the body of the dialog which consists of a button for A and for B
    var choiceGroupDiv = document.createElement('div');
    choiceGroupDiv.setAttribute('class', 'choice-group');

    var btnChoiceA = document.createElement('a');
    btnChoiceA.setAttribute('id', 'choice-A');
    btnChoiceA.setAttribute('class', 'btn btn-sq btn-primary');
    btnChoiceA.innerHTML = 'A';
    choiceGroupDiv.append(btnChoiceA);

    var btnChoiceB = document.createElement('a');
    btnChoiceB.setAttribute('id', 'choice-B');
    btnChoiceB.setAttribute('class', 'btn btn-sq btn-warning choice');
    btnChoiceB.innerHTML = 'B';
    choiceGroupDiv.append(btnChoiceB);

    body.append(choiceGroupDiv);

    modalDialog.modal('show');

    // Register callback functions for the selection of either A or B
    $('#choice-A').click(function(e) {
        sendBallotsToServer(ballots[0], ballots[1]);
    });

    $('#choice-B').click(function(e) {
        sendBallotsToServer(ballots[1], ballots[0]);
    });
}

function sendBallotsToServer(selection, alt) {
    $.ajaxSetup({
        beforeSend: function(xhr, settings) {
            if (!csrfSafeMethod(settings.type) && !this.crossDomain) {
                xhr.setRequestHeader("X-CSRFToken", CSRF);
            }
        }
    });

    // Elliptic curve cryptography params used for encryption of encrypted vote
    // fragments
    var ctx = new CTX("BN254CX");
    var n = new ctx.BIG();
    var g1 = new ctx.ECP();
    var g2 = new ctx.ECP2();

    var parameter = $('#event-param').val();
    var tempParams = JSON.parse(JSON.parse(parameter).crypto);

    //copying the values
    n.copy(tempParams.n);
    g1.copy(tempParams.g1);
    g2.copy(tempParams.g2);

    var params = {
      n:n,
      g1:g1,
      g2:g2
    };

    var tempPK = JSON.parse($('#comb_pk').val());
    var pk = new ctx.ECP(0);
    pk.copy(tempPK.PK);

    var voterID = window.location.search.slice(1).split(/=(.+)/)[1];//.slice(0, -2);
    var eventID = window.location.href.split('/')[4];
    var pollNum = $('#poll-num').text();
    var ballotID = encodeURIComponent(btoa(JSON.stringify({voterID: voterID, eventID: eventID, pollNum: pollNum})));

    var SK = "temporary";
    var encAlt = sjcl.encrypt(SK, JSON.stringify(alt));
    selection = JSON.stringify(selection);

    $.ajax({
         type : "POST",
         url : window.location,
         data : {  handle: ballotID, encBallot: encAlt, ballot: selection },
         success : function(){
             onAfterBallotSend(ballotID, SK);
         }
    });
}

// Called once the ballot has been sent to the back-end and dialog has closed
function onAfterBallotSend(ballotID, SK) {
    let titleText = 'Vote Successfully Received';
    let bodyText = "Thank you for voting! Your secret key is '"+SK+"'. Make sure to scan this QR code with your phone before closing this window.";

    if(POLL_NUM !== POLL_COUNT) {
        bodyText += " You can vote on the next poll by closing down this dialog and clicking 'Next Poll'.";
    }

    // With one ballot selected, we can display a QR code of the ballot ID
    var modalDialog = $('#modalDialog');
    var title = modalDialog.find('.modal-title');
    var body = modalDialog.find('.modal-body');
    title.text(titleText);
    body.empty();

    var p = document.createElement("p");
    p.innerHTML = bodyText;
    body.append(p);

    // Generate the body of the dialog which displays the unselected ballot QR code
    var QRCodeImg = document.createElement('img');
    QRCodeImg.setAttribute('class', 'QR-code');
    new QRCode(QRCodeImg, ballotID);

    body.append(QRCodeImg);

    var closeButton = $('#close-button');
    closeButton.removeClass('btn-danger');
    closeButton.addClass('btn-success');
    closeButton.text("Close");
    if(POLL_NUM == POLL_COUNT) {
        $('#next-button').hide();
    }

    modalDialog.modal('show');
}

$('#modalDialog').on('hide.bs.modal', function (e) {
    var titleText = $(this).find('.modal-title').text();

    if(titleText.indexOf("Received") > -1) {
        // Update page to reflect the fact that a vote has taken place
        location.reload();
    } else {
        // Reset poll voting to allow user to vote again
        progressBar.setAttribute("style", "width: 0%;");
        $('#gen-ballots-btn').toggleClass("hidden");
        $('#progress-bar-description').toggleClass('hidden');
        $('#progress-bar-container').toggleClass('hidden');

        var inputs = $("label input[type=checkbox]");
        inputs.each(function () {
            var input = $(this);
            input.prop('checked', false);
            input.prop('disabled', false);
        });

        selectedCount = 0;
    }

    dialogOpen = false;
});