$('#begin-test').click(function() {
    var ballot = JSON.parse(sjcl.decrypt($('#SK').val(), $('#ballot').text()));
    var votes = ballot['encryptedVotes'][0]['fragments'];
    $('#ballot-content').text(JSON.stringify(votes));

    var option = 0;
    votes.forEach(function(cT) {
        option++;
        var encoding = "";
        for (var i = 0; i < cT['C1'].length; i++) {
            cipherText = "("+cT['C1']+","+cT['C2']+")";
            var m = cT['C2'][i] / Math.pow(cT['C1'][i], cT['r'][i]);
            encoding += (m) ? "1" : "0";
        }
        $('#ballot-result').text($('#ballot-result').text() + "\n\nOption "+option+": "+encoding);
    })
});