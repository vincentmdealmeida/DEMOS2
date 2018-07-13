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

function dropDownFragsNotZero(frags) {
      var valid = false;

      for(var i = 0; i < frags.length; i++) {
          var frag = frags[i];

          if(frag !== "0") {
              valid = true;
              break;
          }
      }

      return valid;
}

function isVotingInputValid() {
    var valid = true;

    // First establish if the user's selection count is valid
    if(!(selectedCount >= MIN_SELECTIONS && selectedCount <= MAX_SELECTIONS)) {
        valid = false;
    }

    // This will highlight when people haven't selected enough options

    if(!valid) {
        var modalDialog = $('#modalDialog');
        var title = modalDialog.find('.modal-title');
        var body = modalDialog.find('.modal-body');
        var errText = "You've only selected " + selectedCount
            + " option(s). The minimum number you need to select is " + MIN_SELECTIONS
            + " and the maximum is " + MAX_SELECTIONS + ". Please go back and correct this.";

        title.text('Voting Error');

        var p = document.createElement("p");
        p.innerHTML = errText;
        body.empty();
        body.append( p );

        modalDialog.modal('show');
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

var progress = 0;
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

        // Push the selected option values to an array
        if(checkbox.prop('checked')) {
            unencryptedVotes.push(checkbox.val());
        }
        // For whatever hasn't been selected, push a blank vote to the array
        else {
            unencryptedVotes.push(genBlankVote());
        }
    });

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

    var ballot = {
        encryptedVotes: encryptedVotes
    };


    return ballot;
}

$('#gen-ballots-btn').click(function() {
    // Ensure that the user selections are valid
    if(isVotingInputValid()) {
        // Hide the button
        $(this).toggleClass('hidden');

        // Inject the description progress bar which can then be updated by the encrypt btn
        $('#progress-bar-description').toggleClass('hidden');
        $('#progress-bar-container').toggleClass('hidden');

        setTimeout(generateBallotsAndShowUsr, 50);
    }
});

function voteSuccessfullyReceived() {
    var modalDialog = $('#modalDialog');
    var title = modalDialog.find('.modal-title');
    var body = modalDialog.find('.modal-body');

    title.text('Vote Successfully Received');
    var bodyText = "Thank you for voting!";

    var p = document.createElement("p");
    p.innerHTML = bodyText;
    body.empty();
    body.append( p );

    modalDialog.modal('show');
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

function generateBallotB(ballotA) {
    var ballotB = generateBallot();
    progressBar.setAttribute("style", "width: 100%;");

    var ballots = {
        A : ballotA,
        B : ballotB
    };

    // TODO: Implement ballot choice UI and QR func here. At the moment the code automatically
    // TODO: submits the first ballot (as if the user selected it) to the server but this needs updating.
    // TODO: Currently, there is a dialog already implemented in the event_vote.html page which is
    // TODO: used for voting error information but could be used to display the ballot choices.
    // This delay allows the execution thread to update the above CSS on the progress bar
    var selectedBallot = ballots.A;

    setTimeout(function () {
        sendBallotToServer(selectedBallot);
    }, 50);
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
    }, 125);
}