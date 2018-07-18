function showDialogWithText(titleTxt, bodyTxt) {
    var modalDialog = $('#modalDialog');
    var title = modalDialog.find('.modal-title');
    var body = modalDialog.find('.modal-body');

    title.text(titleTxt);

    var p = document.createElement("p");
    p.innerHTML = bodyTxt;
    body.empty();
    body.append( p );

    modalDialog.modal('show');
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
        let errText = "You've only selected " + selectedCount
            + " option(s). The minimum number you need to select is " + MIN_SELECTIONS
            + " and the maximum is " + MAX_SELECTIONS + ". Please go back and correct this.";

        let titleTxt = 'Voting Error';

        showDialogWithText(titleTxt, errText);
        return;
    }

    return valid;
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

var progressBar = document.getElementById("progress-bar");

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

            // Store C1 and C2 from the cipher in the fragment
            var c1Bytes = [];
            cipher.C1.toBytes(c1Bytes);

            var c2Bytes = [];
            cipher.C2.toBytes(c2Bytes);

            encFragments.push({
                C1 : c1Bytes.toString(),
                C2 : c2Bytes.toString()
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

$('#gen-ballots-btn').click(function() {
    // Ensure that the user selections are valid
    if(isVotingInputValid()) {
        // Hide the button
        $(this).toggleClass('hidden');

        // Inject the description progress bar which can then be updated by the encrypt btn
        $('#progress-bar-description').toggleClass('hidden');
        $('#progress-bar-container').toggleClass('hidden');

        setTimeout(generateBallotsAndShowUsr, 25);
    }
});

function voteSuccessfullyReceived() {
    let titleTxt = 'Vote Successfully Received';
    let bodyText = "Thank you for voting!";

    if(POLL_NUM !== POLL_COUNT) {
        bodyText += " You can vote on the next poll by closing down this dialog and clicking 'Next Poll'.";
    }

    showDialogWithText(titleTxt, bodyText);
}

var CSRF = $( "input[name='csrfmiddlewaretoken']" ).val();
function csrfSafeMethod(method) {
    // these HTTP methods do not require CSRF protection
    return (/^(GET|HEAD|OPTIONS|TRACE)$/.test(method));
}

function sendBallotToServer(ballot) {
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
         data : JSON.stringify({ ballot: ballot}),
         success : function(){
             voteSuccessfullyReceived();
         }
    });
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

// FAO Ben: Called once the ballot has been sent to the back-end and dialog has closed
function onAfterBallotSend() {
    // TODO: FAO Ben: Implement QR func here.
    // TODO: Currently, there is a dialog already implemented in the event_vote.html page which is
    // TODO: used for voting error information but could be used to display the QR code using JS in
    // TODO: a similar way that showBallotChoiceDialog does.
}

function processBallotSelection(selection, selectionHash, successFn) {
    // Dispatch the ballot to the server
    sendBallotToServer(selection);

    // Close the choice selection dialog
    var modalDialog = $('#modalDialog');
    modal.modal('hide');

    // Call the successfn currently with the selection hash but this may not be needed
    successFn(selectionHash);
}

function showBallotChoiceDialog(ballotA, ballotB) {
    // Output hashes of the 2 ballots
    const BALLOT_A_HASH = SHA256Hash(stringtobytes(JSON.stringify(ballotA)), true);
    const BALLOT_B_HASH = SHA256Hash(stringtobytes(JSON.stringify(ballotB)), true);

    // With the ballots and their hashes generated, we can display the ballot choice dialog
    var modalDialog = $('#modalDialog');
    var title = modalDialog.find('.modal-title');
    var body = modalDialog.find('.modal-body');
    body.empty();
    title.text('Please Select a Ballot');

    // Generate the body of the dialog which consists of a button for A and for B as well as their hashes
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
    hashA.innerHTML = "Hash A: " + BALLOT_A_HASH;
    hashGroupDiv.append( hashA );

    var br2 = document.createElement('br');
    hashGroupDiv.append( br2 );

    var hashB = document.createElement("span");
    hashB.innerHTML = "Hash B: " + BALLOT_B_HASH;
    hashGroupDiv.append( hashB );

    // -----------------------------------------------

    body.append(choiceGroupDiv);
    body.append(hashGroupDiv);

    modalDialog.modal('show');

    // Register callback functions for the selection of either A or B
    $('#choice-A').click(function(e) {
        processBallotSelection(ballotA, BALLOT_A_HASH, onAfterBallotSend);
    });

    $('#choice-B').click(function(e) {
        processBallotSelection(ballotB, BALLOT_B_HASH, onAfterBallotSend);
    });
}

function generateBallotB(ballotA) {
    var ballotB = generateBallot();
    progressBar.setAttribute("style", "width: 100%;");

    showBallotChoiceDialog(ballotA, ballotB);
}

function generateBallotsAndShowUsr() {
    // Generate Ballot A and Ballot B to be displayed to the user
    // This fn starts the process
    var ballotA = generateBallot();

    // Update the progress bar once the generation has completed
    progressBar.setAttribute("style", "width: 50%;");

    // This delay allows the execution thread to update the above CSS on the progress bar
    setTimeout(function () {
        generateBallotB(ballotA);
    }, 150);
}