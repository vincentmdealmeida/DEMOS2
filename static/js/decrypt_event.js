function processFileSKChange(event) {
    var files = event.target.files;

    if(files !== undefined
        && files[0] !== undefined) {
        var reader = new FileReader();

        reader.onload = function(e) {
          $('input#secret-key').val(reader.result);
        };

        reader.readAsText(files[0]);
    }
}

var filesHandleSK = document.getElementById('files_sk_upload');

if(filesHandleSK) {
    filesHandleSK.addEventListener('change', processFileSKChange, false);
}