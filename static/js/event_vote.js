var dialogOpen = false;
var DIALOG_BTN_STATES = {
    STEP_1: 1,
    STEP_2: 2,
    STEP_3: 3,
    VOTE_SUCCESS: 4,
    VOTE_ERROR: 5
};

function showDialogWithText(titleTxt, bodyTxt) {
    var modalDialog = $('#modalDialog');
    var title = modalDialog.find('.modal-title');
    var body = modalDialog.find('.modal-body');

    title.text(titleTxt);

    var p = document.createElement("p");
    p.innerHTML = bodyTxt;
    body.empty();
    body.append(p);

    if (!dialogOpen) {
        modalDialog.modal('toggle');
        dialogOpen = true;
    }
}

function updateDialogButtons(state) {
    // Trigger the btn selectors once here
    let nextDialogBtn = $('#nextDialogBtn');
    let cancelDialogBtn = $('#cancelDialogBtn');
    let closeDialogBtn = $('#closeDialogBtn');
    let startOverDialogBtn = $('#startOverDialogBtn');
    let submitDialogBtn = $('#submitDialogBtn');

    switch(state) {
        case DIALOG_BTN_STATES.STEP_1:
            nextDialogBtn.removeClass("hidden");
            cancelDialogBtn.removeClass("hidden");
            closeDialogBtn.addClass("hidden");
            startOverDialogBtn.addClass("hidden");
            submitDialogBtn.addClass("hidden");
            break;
        case DIALOG_BTN_STATES.STEP_2:
            nextDialogBtn.addClass("hidden");
            cancelDialogBtn.removeClass("hidden");
            closeDialogBtn.addClass("hidden");
            startOverDialogBtn.addClass("hidden");
            submitDialogBtn.addClass("hidden");
            break;
        case DIALOG_BTN_STATES.STEP_3:
            nextDialogBtn.addClass("hidden");
            cancelDialogBtn.addClass("hidden");
            closeDialogBtn.addClass("hidden");
            startOverDialogBtn.removeClass("hidden");
            submitDialogBtn.removeClass("hidden");
            break;
        case DIALOG_BTN_STATES.VOTE_SUCCESS:
        case DIALOG_BTN_STATES.VOTE_ERROR:
            nextDialogBtn.addClass("hidden");
            cancelDialogBtn.addClass("hidden");
            closeDialogBtn.removeClass("hidden");
            startOverDialogBtn.addClass("hidden");
            submitDialogBtn.addClass("hidden");
            break;
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
        updateDialogButtons(DIALOG_BTN_STATES.VOTE_ERROR);
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
    // Get the user's selected option
    let inputs = $("label input[type=checkbox]");
    let selectedOption = "";
    inputs.each(function() {
        let input = $(this);

        if(input.prop('checked')) {
            selectedOption = input.val();
            selectedOption = document.getElementById(selectedOption).innerText;
        }
    });

    // Generate Ballot A and Ballot B to be displayed to the user
    // This fn starts the process
    var ballotA = generateBallot();

    // Update the progress bar once the generation has completed
    progressBar.setAttribute("style", "width: 50%;");

    // This delay allows the execution thread to update the above CSS on the progress bar
    setTimeout(function () {
        var ballotB = generateBallot();
        progressBar.setAttribute("style", "width: 100%;");

        showFirstQRCode(ballotA, ballotB, selectedOption);
    }, 150);
}

// Called in stage 1 of 3 in the voting process
function showFirstQRCode(ballotA, ballotB, selectedOption) {
    var ballots = new Array(ballotA, ballotB);
    var ballotHashes = new Array(2);

    // Hash both ballots and store
    for (let i = 0; i <= 1; i++)
        ballotHashes[i] = SHA256Hash(stringtobytes(JSON.stringify(ballots[i])), true);

    // With the ballots and their hashes generated, we can display the QR code of both hashes
    var modalDialog = $('#modalDialog');
    var title = modalDialog.find('.modal-title');
    var body = modalDialog.find('.modal-body');

    body.empty();
    title.text('Step 1 of 3: Link Your Vote');

    let pleaseScanP = document.createElement('p');
    pleaseScanP.innerHTML = "Please scan the following QR code from your DEMOS 2 mobile application:";

    let QRDiv = document.createElement('div');
    var QRCodeImg = document.createElement('img');
    QRCodeImg.setAttribute('class', 'QR-code');
    QRCodeImg.setAttribute('id', "qr-img");
    new QRCode(QRCodeImg, ballotHashes[0] + ';' + ballotHashes[1]);
    QRDiv.append(QRCodeImg);

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

    body.append(pleaseScanP);
    body.append(QRDiv);
    body.append(hashGroupDiv);

    // Prepare the appropriate dialog buttons
    updateDialogButtons(DIALOG_BTN_STATES.STEP_1);

    if(!dialogOpen) {
        modalDialog.modal('toggle');
        dialogOpen = true;
    }

    $('#nextDialogBtn').click(function(e) {
        showBallotChoiceDialog(ballots, ballotHashes, selectedOption, modalDialog);
    });
}

// Called in stage 2 of 3 in the voting process
function showBallotChoiceDialog(ballots, ballotHashes, selectedOption, dialog) {
    // Display the ballot choice dialog
    var title = dialog.find('.modal-title');
    var body = dialog.find('.modal-body');

    body.empty();
    title.text('Step 2 of 3: Select a Ballot');

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

    body.append(choiceGroupDiv);
    body.append(hashGroupDiv);

    // Register callback functions for the selection of either A or B
    $('#choice-A').click(function(e) {
        showSelectionConfirmationDialog("A", ballots[0], ballotHashes[0], ballots[1], selectedOption, dialog);
    });

    $('#choice-B').click(function(e) {
        showSelectionConfirmationDialog("B", ballots[1], ballotHashes[1], ballots[0], selectedOption, dialog);
    });

    updateDialogButtons(DIALOG_BTN_STATES.STEP_2);

    if(!dialogOpen) {
        modalDialog.modal('toggle');
        dialogOpen = true;
    }
}

// Called in stage 3 of 3 in the voting process
function showSelectionConfirmationDialog(selection, selectedBallot, selectedBallotHash,
                                         otherBallot, selectedOption, dialog) {
    let title = dialog.find('.modal-title');
    let body = dialog.find('.modal-body');
    body.empty();

    title.text("Step 3 of 3: Confirm Ballot Selection");

    // Ballot detail section
    let selectedInfoSecDiv = document.createElement('div');

    let detailsP = document.createElement('p');
    detailsP.innerHTML = "Please check the following details are correct: ";
    selectedInfoSecDiv.append(detailsP);

    let ul = document.createElement('ul');

    let selectedOptionLi = document.createElement('li');
    selectedOptionLi.innerHTML = "Selected Option: " + selectedOption;

    let ballotSelectionLi = document.createElement('li');
    ballotSelectionLi.innerHTML = "Selected Ballot: " + selection;

    let ballotHashLi = document.createElement('li');
    ballotHashLi.innerHTML = "SHA256 Ballot Fingerprint: " + selectedBallotHash;

    ul.append(selectedOptionLi);
    ul.append(ballotSelectionLi);
    ul.append(ballotHashLi);
    selectedInfoSecDiv.append(ul);

    // Instruction section
    let instructionsP = document.createElement('p');
    instructionsP.innerHTML = "If you are happy with your selection you can click on the 'Submit' button below to store"
        + " your vote. Otherwise you can select 'Start Over' to go through the voting process again.";
    selectedInfoSecDiv.append(instructionsP);

    let additionalInstructionsP = document.createElement('p');
    additionalInstructionsP.innerHTML = "You can overwrite your vote later by re-visiting this page and voting again.";
    selectedInfoSecDiv.append(additionalInstructionsP);

    body.append(selectedInfoSecDiv);

    // Update the dialog buttons accordingly
    updateDialogButtons(DIALOG_BTN_STATES.STEP_3);

    $('#submitDialogBtn').click(function() {
        // Dispatch the ballot to the server
        sendBallotsToServer(selection, selectedBallot, otherBallot);
    });

    if(!dialogOpen) {
        modalDialog.modal('toggle');
        dialogOpen = true;
    }
}

function sendBallotsToServer(selection, selectedBallot, otherBallot) {
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

    // TODO: Generate a SK rather than using a static one. UUID generated server side and then injected JS side?
    var SK = "temporary";
    var encAlt = sjcl.encrypt(SK, JSON.stringify(otherBallot));
    let selectedBallotAsStr = JSON.stringify(selectedBallot);

    $.ajax({
         type : "POST",
         url : window.location,
         data : {  handle: ballotID, encBallot: encAlt, ballot: selectedBallotAsStr, selection: selection },
         success : function(){
             onAfterBallotSend(ballotID, SK);
         }
    });
}

// Called once the ballot has been sent to the back-end and dialog has closed
function onAfterBallotSend(ballotID, SK) {
    // With one ballot selected, we can display a QR code of the ballot ID
    var modalDialog = $('#modalDialog');
    var title = modalDialog.find('.modal-title');
    var body = modalDialog.find('.modal-body');
    body.empty();

    let titleText = 'Vote Successfully Received';
    title.text(titleText);

    // Add the first section: Instructions on next steps
    let instructions1Txt = "Thank you for voting! Please note down the ballot identifier by scanning " +
        "this QR code using the DEMOS2 mobile application: ";

    var instructions1P = document.createElement("p");
    instructions1P.innerHTML = instructions1Txt;
    body.append(instructions1P);

    // Add the second section: QR code that contains the ballot identifier
    var QRCodeImg = document.createElement('img');
    QRCodeImg.setAttribute('class', 'QR-code');
    new QRCode(QRCodeImg, ballotID);

    body.append(QRCodeImg);

    // Add the third section: instructions on Ballot ID and SK
    let instructions2Div = document.createElement('div');
    instructions2Div.setAttribute('class', 'containerMarginTop');

    let instructions2Txt = "You will also be emailed the ballot identifier. However, you will need to note down the following " +
        "secret in order to later verify your ballot was recorded as cast: ";
    let instructions2P = document.createElement('p');
    instructions2P.innerHTML = instructions2Txt;
    instructions2Div.append(instructions2P);
    body.append(instructions2Div);

    // Add the fourth section: SK plain text
    let SKContainerDiv = document.createElement('div');
    SKContainerDiv.setAttribute("class", "containerMarginTop");

    let SKDiv = document.createElement('div');
    SKDiv.setAttribute("class", "skDIV");

    let SKP = document.createElement('p');
    SKP.innerHTML = SK;
    SKDiv.append(SKP);

    SKContainerDiv.append(SKDiv);
    body.append(SKContainerDiv);

    // Conditional fifth section: Instructions on how to vote on the next poll for the event
    if(POLL_NUM !== POLL_COUNT) {
        let instructions3Txt = "You can vote on the next poll by closing down this dialog and clicking 'Next Poll'.";
        let instructions3P = document.createElement('p');
        instructions3P.innerHTML = instructions3Txt;
        body.append(instructions3P);
    }

    updateDialogButtons(DIALOG_BTN_STATES.VOTE_SUCCESS);
}

$('#modalDialog').on('hide.bs.modal', function (e) {
    var titleText = $(this).find('.modal-title').text();

    if(titleText.indexOf("Received") > -1) {
        // Update page to reflect the fact that a vote has taken place
        location.reload();
    } else if (titleText.indexOf("Error") === -1) {
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