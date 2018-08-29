$('#begin-test').click(function() {
    var ballot = JSON.parse(sjcl.decrypt($('#SK').val(), $('#ballot').text()));

    var votes = ballot['encryptedVotes'];
    $('#ballot-content').text(JSON.stringify(votes));
    var voteNum = 0, optionNum = 0;

    // For each encrypted vote within the ballot...
    votes.forEach(function(vote) {
        voteNum++;
        $('#ballot-result').text($('#ballot-result').text() + "Vote " + voteNum + ": \n ");

        // For each encrypted fragment within the vote (i.e. the presence of a vote for each option)...
        vote['fragments'].forEach(function(fragment) {
            optionNum++;
            $('#ballot-result').text($('#ballot-result').text() + "Option " + optionNum + ": \n  ");

            var encoding = "";
            console.log(fragment);

            // For each pair of values in C1 and C2 and the randomness r, test whether C2/(C1)^r = g^0 or g^1, and
            // record g's exponent.
            for (var i = 0; i < fragment['C1'].length; i++) {
                cipherText = "("+fragment['C1']+","+fragment['C2']+")";
                var m = fragment['C2'][i] / Math.pow(fragment['C1'][i], fragment['r'][i]);
                encoding += (m) ? "1" : "0";
            }

            // Somehow, this string of 1s and 0s  here needs to become _one_ 1 or 0 to signify whether the option was
            // voted for or not.
            $('#ballot-result').text($('#ballot-result').text() + encoding + "\n ");
        });
    });
});