// Form submission and validation
var updateModes = {create: 1, update: 2, delete: 3};
var submitBtn = $("#submit-event-create");
var submitBtnLabel = "Create Event";
var submitBtnWaitLabel = "Please wait...";
var submitBtnErrLabel = "Errors Found";
var dateRegex = /^[0-9]{4}-(((0[13578]|(10|12))-(0[1-9]|[1-2][0-9]|3[0-1]))|(02-(0[1-9]|[1-2][0-9]))|((0[469]|11)-(0[1-9]|[1-2][0-9]|30)))\s[0-9]?[0-9]:[0-9]{2}\s\+[0-9]{2}:[0-9]{2}$/;
var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
var reCaptchaValid = false;
var generalErrorBlock = document.getElementById('all-errors-help-block');
var errors = [];
var create = true;
var pollCount = 0;
var pollIndex = 0;
var pollEditActive = false;
var numOfOpts = 2;

function finalisePolls() {
    // Update the value of the poll count input
    $('#poll-count-input').val(pollCount);

    // Remove the empty and hidden poll row from the poll table
    var formset = $(".formset[data-formset-prefix='polls']");
    var emptyForm = formset.children('.formset-form-empty');
    emptyForm.remove();
}

$("#election-form").submit(function(e) {
    // Intercept submission of form and temporarily suspend it
    e.preventDefault();
    var form = this;

    // Get a reference to the submit button
    submitBtn.prop('disabled', true);
    submitBtn.val(submitBtnWaitLabel);

    // Disable the cancel button during validation
    var cancelBtn = $("#cancel-event-create");
    cancelBtn.prop('disabled', true);

    // Perform input validation
    var formDataValid = isFormValid();

    if( formDataValid === true ) {
        clearErrors();
        finalisePolls();
        form.submit();
    } else {
        submitBtn.val(submitBtnErrLabel);
        cancelBtn.removeAttr('disabled');
        highlightErrors();
    }
});

function validateForm() {
    var formDataValid = isFormValid();

    if( formDataValid === true ) {
        clearErrors();
        submitBtn.removeAttr('disabled');
        submitBtn.val(submitBtnLabel);
    } else {
        submitBtn.val(submitBtnErrLabel);
        highlightErrors();
    }
}

function isFormValid() {
    var nameValid = isNameValid();
    var slugValid = isSlugValid();
    var voteStartValid = isVoteStartValid();
    var voteEndValid = isVoteEndValid();
    var eventTimingsValid = isEventTimingsValid();
    var pollCountValid = isPollCountValid();
    var organisersEmailsValid = areOrganisersEmailsValid();
    var trusteesEmailsValid = areTrusteesEmailsValid();
    var votersListValid = isVotersListValid();

    return nameValid && slugValid && voteStartValid && voteEndValid && pollCountValid
        && eventTimingsValid && organisersEmailsValid && trusteesEmailsValid && votersListValid;
}

function validateFormField(validationFn, helpBlockId) {
    var valid = validationFn();

    if(valid === false) {
        highlightError(helpBlockId);
    } else {
        clearError(helpBlockId);

        if(reCaptchaValid === true) {
            if(submitBtn.val() === submitBtnErrLabel) {
                clearErrors();
            }

            submitBtn.removeAttr('disabled');
            submitBtn.val(submitBtnLabel);
        }
    }
}

function isNameValid() {
    // Based on a list of names supplied from the create_event html template
    if(events_list !== undefined) {
        var valid = true;
        var event_name = $('#name-input').val().trim();

        if(event_name === '') {
            checkAndAddError({
                error: "The event name field is blank.",
                helpBlockId: "name-input-error-block"
            });

            return false;
        }

        for(var i = 0; i < events_list.length; i++) {
            var name = events_list[i].title;

            if(name === event_name) {
                valid = false;

                // We need to flag this error to the user by generating an error that's
                // later rendered
                checkAndAddError({
                    error: "The event name '" + event_name + "' is already in use.",
                    helpBlockId: "name-input-error-block"
                });
            }
        }

        return valid;
    } else {
        // Can't perform validation
        return true;
    }
}

$('#name-input').on('input', function (e) { // Validation performed with every keystroke
    validateFormField(isNameValid, "name-input-error-block");
});

function isSlugValid() {
    // Based on a list of identifiers supplied from the create_event html template
    if(events_list !== undefined) {
        var valid = true;
        var event_slug = $('#identifier-input').val();

        if(event_slug === '') {
            checkAndAddError({
                error: "The event slug field is blank.",
                helpBlockId: "identifier-input-error-block"
            });

            return false;
        }

        for(var i = 0; i < events_list.length; i++) {
            var slug = events_list[i].slug;

            if(slug === event_slug) {
                valid = false;

                // We need to flag this error to the user by generating an error that's
                // later rendered
                checkAndAddError({
                    error: "The event slug '" + event_slug + "' is already in use.",
                    helpBlockId: "identifier-input-error-block"
                });
            }
        }

        return valid;
    } else {
        // Can't perform validation
        return true;
    }
}

$('#identifier-input').on('input', function(e) {
    validateFormField(isSlugValid, "identifier-input-error-block");
});

function isVoteStartValid() {
    var helpBlockId = "vote-start-input-error-block";
    var start_date_time = $('#vote-start-input').val();
    var valid = isDateValid(start_date_time);

    if(valid === false) {
        checkAndAddError({
            error: "The voting start date and time format is invalid.",
            helpBlockId: helpBlockId
        })
    } else {
        clearError(helpBlockId);
    }

    return valid;
}

$('#vote-start-input').change(function(e) {
    validateFormField(isVoteStartValid, "vote-start-input-error-block");
});

$( "#vote-start-input" ).click(function() {
  $( "#vote-start-input" ).change();
});

function isVoteEndValid() {
    var helpBlockId = "vote-end-input-error-block";
    var end_date_time = $('#vote-end-input').val();
    var valid = isDateValid(end_date_time);

    if(valid === false) {
        checkAndAddError({
            error: "The voting end date and time format is invalid.",
            helpBlockId: helpBlockId
        })
    }

    return valid;
}

$('#vote-end-input').change(function(e) {
    validateFormField(isVoteEndValid, "vote-end-input-error-block");
});

$( "#vote-end-input" ).click(function() {
  $( "#vote-end-input" ).change();
});

// This is different to the start and end validation functions in that it will check whether or not
// the start and end times overlap in an invalid way i.e. end time is before start etc.
function isEventTimingsValid() {
    var valid = true;
    var helpBlockId = "event-timings-error-block";

    // Extract the dates from the vote start and end input controls
    var start_date_time = $('#vote-start-input').data('DateTimePicker').date();
    var end_date_time = $('#vote-end-input').data('DateTimePicker').date();

    // Ensure that the start date is before the end date and that the end date is after the start date
    if(!(start_date_time < end_date_time && end_date_time > start_date_time)) {
        checkAndAddError({
           error: "The start date must be before the end date and the end after the start date.",
           helpBlockId: "event-timings-error-block"
        });

        valid = false;
    } else {
        clearError(helpBlockId);
    }

    return valid;
}

function isDateValid(date_time) {
    return dateRegex.test(date_time);
}

function isPollCountValid() {
    var valid = true;

    if(pollCount < 1) {
        checkAndAddError({
            error: "You need to define at least 1 poll.",
            helpBlockId: "polls-input-error-block"
        });

        valid = false;
    }

    return valid;
}

function isPollQValid() {
    var valid = true;

    // Check question is valid
    var question = $('#question-name-input-' + pollIndex).val();

    if(question === '') {
        checkAndAddError({
            error: "Question / Statement for the poll is blank.",
            helpBlockId: "question-input-error-block-" + pollIndex
        });

        valid = false;
    }

    return valid;
}

function isPollOptionsValid() {
    var valid = true;
    var optsInputs = $('.option-formset #option-name-input-' + pollIndex);
    var helpBlockId = "options-input-error-block-" + pollIndex;

    if(numOfOpts < 1) {
        checkAndAddError({
            error: "There needs to be at least 1 option",
            helpBlockId: helpBlockId
        });

        return false;
    }

    var index = 0;
    var errorStr = "Option ";
    for(var i = 0; i < optsInputs.length; i++) {
        var input = optsInputs[i];

        if(input.placeholder.indexOf("X") === -1) {

            if(input.value === ''){
                errorStr = errorStr + (index+1) + " ";

                valid = false;
            }

            index++;
        }
    }

    if(valid === false) {
        errorStr = errorStr + " is blank.";

        checkAndAddError({
           error: errorStr,
           helpBlockId: helpBlockId
        });
    }

    return valid;
}

function isMinMaxSelectionValid() {
    var valid = true;
    var minInput = $('#minimum-input-' + pollIndex);
    var minInputMinAttr = parseInt(minInput[0].min);
    var minInputVal = minInput.val();
    var helpBlockId = "selections-input-error-block-" + pollIndex;
    var errorStr = "";

    if(minInputVal === "" || minInputVal < minInputMinAttr) {
        errorStr = "The minimum option selection value cannot be less than " + minInputMinAttr + " or blank";
        valid = false;
    } else if (minInputVal > numOfOpts) {
        errorStr = "The minimum option selection value cannot be more than the number of options (" + numOfOpts + ")";
        valid = false;
    }

    var maxInput = $('#maximum-input-' + pollIndex);
    var maxInputMinAttr = parseInt(maxInput[0].min);
    var maxInputVal = maxInput.val();

    if(maxInputVal === "" || maxInputVal < maxInputMinAttr) {
        if(errorStr !== '') {
            errorStr = errorStr + " and the maximum cannot be less than " + maxInputMinAttr + " or blank";
        } else {
            errorStr = "The maximum option selection value cannot be less than " + maxInputMinAttr + " or blank";
        }

        valid = false;
    } else if (maxInputVal > numOfOpts) {
        if (errorStr !== '') {
            errorStr = errorStr + " and the maximum cannot be more than the number of options (" + numOfOpts + ")";
        } else {
            errorStr = "The maximum option selection value (" + maxInputVal + ") cannot be more than the number of options (" + numOfOpts + ")";
        }

        valid = false;
    }

    if(valid === false) {
        errorStr = errorStr + ".";

        checkAndAddError({
           error: errorStr,
           helpBlockId: helpBlockId
        });
    }

    return valid;
}

function areOrganisersEmailsValid() {
    var valid = true;
    var organiserInputs = $('.organiser-formset #organiser-email-input');
    var helpBlockId = "organisers-input-error-block";

    var index = 0;
    var errorBlankStr = "Organiser ";
    var errorInvalidStr = "Organiser ";
    var errorNotUserStr = "";
    for(var i = 0; i < organiserInputs.length; i++) {
        var input = organiserInputs[i];

        if(input.placeholder.indexOf("X") === -1) {
            // Check if the input field is blank
            if(input.value === ''){
                errorBlankStr = errorBlankStr + (index+1) + " ";

                valid = false;
            } else {
                // Ensure that any email supplied is of a valid format
                if (emailRegex.test(input.value) === false) {
                    errorInvalidStr = errorInvalidStr + (index + 1) + " ";

                    valid = false;
                } else {
                    // If the email format is valid, ensure that an email of a registered DemoUser is being
                    // supplied and not a random email address
                    var foundMatch = user_emails.some(function (obj) {
                       return obj.email === input.value;
                    });

                    if(!foundMatch) {
                        errorNotUserStr = input.value + " is not a registered user and cannot be an organiser.";
                        valid = false;
                    }
                }
            }

            index++;
        }
    }

    if(valid === false) {
        var errorStr = "";

        // Will be greater than 10 if either a blank input or invalid input has been detected (10 char is the base
        // length of the original err strings)
        if( errorBlankStr.length > 10 ) {
            errorStr = errorBlankStr + " email is blank. ";
        }

        if( errorInvalidStr.length > 10 ) {
            errorStr = errorStr + errorInvalidStr + " email is invalid. ";
        }

        // This means an invalid user has been detected
        if(errorNotUserStr.length > 0) {
            errorStr = errorStr + errorNotUserStr;
        }

        checkAndAddError({
           error: errorStr,
           helpBlockId: helpBlockId
        });
    }

    return valid;
}

$('.organiser-formset #organiser-email-input').on('input', function(e) {
   validateFormField(areOrganisersEmailsValid, "organisers-input-error-block");
});

function areTrusteesEmailsValid() {
    var valid = true;
    var trusteeInputs = $('.trustee-formset #trustee-email-input');
    var helpBlockId = "trustees-input-error-block";

    var index = 0;
    var errorBlankStr = "Trustee ";
    var errorInvalidStr = "Trustee ";
    for(var i = 0; i < trusteeInputs.length; i++) {
        var input = trusteeInputs[i];

        if(input.placeholder.indexOf("X") === -1) {
            // Check if the input field is blank
            if(input.value === ''){
                errorBlankStr = errorBlankStr + (index+1) + " ";

                valid = false;
            } else if (emailRegex.test(input.value) === false) {
                errorInvalidStr = errorInvalidStr + (index+1) + " ";

                valid = false;
            }

            index++;
        }
    }

    if(valid === false) {
        var errorStr = "";

        // Will be greater than 8 if either a blank input or invalid input has been detected (8 char is the base
        // length of the original err strings)
        if( errorBlankStr.length > 8 ) {
            errorStr = errorBlankStr + " email is blank. ";
        }

        if( errorInvalidStr.length > 8 ) {
            errorStr = errorStr + errorInvalidStr + " email is invalid.";
        }

        checkAndAddError({
           error: errorStr,
           helpBlockId: helpBlockId
        });
    }

    return valid;
}

$('.trustee-formset #trustee-email-input').on('input', function(e) {
   validateFormField(areTrusteesEmailsValid, "trustees-input-error-block");
});

function isVotersListValid() {
    var valid = true;
    var helpBlockId = "voters-input-error-block";
    var votersInputVal = $('#voters-list-input').val();

    // Check if the text area is blank
    if(votersInputVal === '') {
        checkAndAddError({
            error: "The voters list is blank.",
            helpBlockId: helpBlockId
        });

        return false;
    }

    var errorStr = "";
    var invalidCount = 0;

    // Check whether one or multiple emails have been supplied
    if(votersInputVal.indexOf(',') === -1) {
        // Check the validity of the single email address
        if(emailRegex.test(votersInputVal) === false) {
            errorStr = errorStr + votersInputVal + " ";
            valid = false;
            invalidCount++;
        }
    } else {
        // Proceed to check if the data within the text area is valid csv
        var csvParseOutput = Papa.parse(votersInputVal);

        if (csvParseOutput.errors.length > 0) {
            checkAndAddError({
                error: "The voters list contains invalid data. It should be a csv list containing voter email addresses.",
                helpBlockId: helpBlockId
            });

            return false;
        }

        // Check that the emails supplied are valid email addresses (using a basic regex)
        var votersEmails = csvParseOutput.data[0];

        for(var i = 0; i < votersEmails.length; i++) {
            var voter_email = votersEmails[i].replace(' ', '');

            if (emailRegex.test(voter_email) === false) {
                errorStr = errorStr + voter_email + " ";
                valid = false;
                invalidCount++;
            }
        }
    }

    if(valid === false) {
        if(invalidCount > 1) {
            errorStr = errorStr + "are invalid email addresses.";
        } else {
            errorStr = errorStr + "is an invalid email address.";
        }

        checkAndAddError({
           error: errorStr,
           helpBlockId: helpBlockId
        });
    }

    return valid;
}

$('#voters-list-input').change(function(e) {
    validateFormField(isVotersListValid, "voters-input-error-block");
});

function checkAndAddError(newError) { // Ensures that an error hasn't already been pushed
    var found = errors.some(function(error) {
       return error.error === newError.error && error.helpBlockId === newError.helpBlockId
    });

    if(!found) {
        errors.push(newError);
    }
}

function highlightErrors() {
    // Generate the general list of errors
    var baseGeneralString = "Errors were found in the form as follows:\n";
    generalErrorBlock.appendChild(document.createTextNode(baseGeneralString));
    generalErrorBlock.appendChild(makeErrorUL());
}

function highlightError(helpBlockId) {
    for(var i = 0; i < errors.length; i++) {
        var error = errors[i];
        if(helpBlockId === error.helpBlockId) {
            $('#' + helpBlockId).html(error.error);
        }
    }
}

function makeErrorUL() {
    // Create the list element:
    var list = document.createElement('ul');

    for(var i = 0; i < errors.length; i++) {
        // Perform list item generation
        // Create the list item:
        var item = document.createElement('li');

        // Set its contents:
        var errorText = errors[i].error;
        item.appendChild(document.createTextNode(errorText));

        // Add it to the list:
        list.appendChild(item);

        // Populate the error's associated error block with the data
        $('#' + errors[i].helpBlockId).html(errorText);
    }

    return list;
}

function clearErrors() {
    // Clear the errors array
    errors.splice(0,errors.length);

    // Clear the general list of errors
    $('#all-errors-help-block').html('');
}

function clearError(helpBlockId) {
    $('#' + helpBlockId).html('');

    errors = errors.filter(e => e.helpBlockId !== helpBlockId);
}

// File handling

function processFileChange(event) {
    var files = event.target.files;

    // By parsing the file we ensure that it's valid CSV at the client side. Papa parse
    // also allows us to aggregate emails from multiple rows in a file.
    if(files !== undefined
        && files[0] !== undefined) {
        Papa.parse(files[0], {
            complete: function(results) {
                var errors = results.errors;

                if(errors.length === 0) {
                    var data = results.data;
                    var numRows = data.length;
                    var totalNumEmails = 0;
                    var emails = [];

                    if(numRows > 1) {
                        for(var i = 0; i < numRows; i++) {
                            var numEmails = data[i].length;
                            totalNumEmails += numEmails;

                            for(var j = 0; j < numEmails; j++) {
                                emails.push(data[i][j]);
                            }
                        }
                    } else if(numRows === 1) {
                        totalNumEmails = data[0].length;

                        for(var i = 0; i < totalNumEmails; i++) {
                            emails.push(data[0][i]);
                        }
                    }

                    $('#result').removeClass("hidden").html(
                       totalNumEmails + " email(s) have been successfully uploaded.");

                    $('#voters-list-input').val(emails.join(', '));

                    // Finally validate the form field
                    validateFormField(isVotersListValid, "voters-input-error-block");
                } else {
                    // There were errors, so inform the user
                    $('#result')
                        .removeClass("hidden")
                        .html("Error reading uploaded file! Check the format and try again")
                        .addClass("errorText");
                }
            }
        });
    }
}

var filesHandle = document.getElementById('files');

if(filesHandle) {
    filesHandle.addEventListener('change', processFileChange, false);
}

// reCAPTCHA

function reCVerificationCallback() {
    reCaptchaValid = true;
    validateForm();
}

function reCExpiredCallback() {
    reCaptchaValid = false;
    submitBtn.prop('disabled', true);
}

// Slug field.

function slugify(value) {
    return value.toString()
        .replace(/[^\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03CE\w\s-]+/g, '')
        .replace(/^[-\s]+/, '')
        .replace(/[-\s]+$/, '')
        .replace(/[-\s]+/g, '-')
        .toLowerCase();
}

$('#name-input').on('input', function (e) {
    var slugField = $('#identifier-input');
    if (!slugField.data('changed')) {
        var name = $(this).val();
        var maxLength = parseInt(slugField.attr('maxlength'));
        var slug = slugify(name).substring(0, maxLength);
        slugField.val(slug);
        slugField.trigger('input');
    }
});

$('#identifier-input').change(function (e) {
    $(this).data('changed', $(this).val().length > 0);
});

// Poll start and end

var datetime_now = window.moment().seconds(0);
var datetime_format = "YYYY-MM-DD H:mm";
$("#vote-start-input, #vote-end-input").each(function(index, element) {

    // Set datetimepickers' current, default and minimum date/time

    var datetime_picker = $(element);
    var datetime_iso8601 = datetime_picker.siblings(".datetime-iso8601-input").val();
    var datetime_local = moment(datetime_iso8601);

    datetime_picker.datetimepicker({
        sideBySide: false,
        minDate: datetime_now.clone().startOf("day"),
        format: datetime_format,
        widgetParent: $(datetime_picker)
    });

    var minutes = (Math.ceil(datetime_now.minute() / 5) * 5) + 5 * index;
    var datetime_default = datetime_now.clone().minutes(minutes);

    datetime_picker.data("DateTimePicker").defaultDate(datetime_default);

    datetime_local = datetime_local.isValid() ? datetime_local.format(datetime_format) : "";
    datetime_picker.children("input").val(datetime_local);
});

$('#vote-start-input, #vote-end-input').parent('.date').datetimepicker({
    allowInputToggle: true,
    icons: {
        time: 'fa fa-clock-o',
        date: 'fa fa-calendar',
        up: 'fa fa-chevron-up',
        down: 'fa fa-chevron-down',
        previous: 'fa fa-chevron-left',
        next: 'fa fa-chevron-right'
    },
    minDate: moment().startOf('day'),
    useCurrent: false,
    locale: moment.utc()
});

// Form management and Sortable rows

function update(event, ui) {
    var formsetPrefix = $(event.target.lastElementChild).attr('data-formset-prefix');
    var formset = $('.formset[data-formset-prefix="' + formsetPrefix + '"]');
    updateFormset(formset);
}

$("#polls-input-table, #organisers-input-table, #trustees-input-table").sortable({
    items: "tr",
    update: update
});


function updateFormset(formset) { // Ported from DEMOS 1. Updates the row number for the # and performs any removals.
    var forms = formset.children('.formset-form:not(.formset-form-empty, .formset-form-removed)');
    var removedForms = formset.children('.formset-form.formset-form-removed');
    forms.each(function(index) {
        updateForm($(this), index, updateModes.update);
    });
    removedForms.each(function(index) {
        updateForm($(this), forms.length + index, updateModes.delete);
    });
}

function updateForm(form, formIndex, mode) { // Ported from DEMOS 1.
    // Specific update for option forms
    var mayBeTextInput = form.find('input:text')[0];
    if(mayBeTextInput !== undefined && mayBeTextInput.placeholder !== undefined) {
        if( mayBeTextInput.placeholder.indexOf("Candidate") > -1) {
            mayBeTextInput.placeholder = "Example: Candidate " + (formIndex + 1);
        } else if (mayBeTextInput.placeholder.indexOf("trusteeX") > -1) {
            mayBeTextInput.placeholder = "Example: trustee@example.com";
        } else if (mayBeTextInput.placeholder.indexOf("organiserX") > -1) {
            mayBeTextInput.placeholder = "Example: organiser@example.com";
        }
    }

    var formset = form.parent('.formset');
    var formsetPrefix = formset.attr('data-formset-prefix');

    if (formsetPrefix === 'polls' && mode === updateModes.update) {
        // Get a reference to the fields that need updating from the form including the table
        var formFields = form.find('.formset-form-fields:first >');
        var table = form.find('.table:first');

        // Perform the ID updates on the fields based on the poll index
        performFormInputUpdates(formFields, table, formIndex);
    }

    var formPrefix = formsetPrefix + '-' + formIndex;
    var formPrefixRegex = new RegExp(formsetPrefix + '-(?:__prefix__|\\d+)');
    form.find('*').addBack().each(function(index, element) {
        $.each(this.attributes, function(index, attr) {
            $(element).attr(attr.nodeName, function(index, attrValue) {
                return attrValue.replace(formPrefixRegex, formPrefix);
            });
        });
    });
    form.find('input[name="' + formPrefix + '-ORDER"]').val(formIndex);
    form.find('.formset-form-index:first').text(formIndex + 1);
}

function manageTotalForms(formset, value) { // Ported from DEMOS1.
    var formsetPrefix = formset.attr('data-formset-prefix');
    var totalForms = $('#id_' + formsetPrefix + '-TOTAL_FORMS');
    var maxNumForms = $('#id_' + formsetPrefix + '-MAX_NUM_FORMS');
    totalForms.val(parseInt(totalForms.val()) + value);
    var addButton = $('.formset-add[data-formset-prefix="' + formsetPrefix + '"]');
    var removedForms = formset.children('.formset-form.formset-form-removed');
    addButton.prop('disabled', parseInt(totalForms.val()) - removedForms.length >= parseInt(maxNumForms.val()));
}

function updatePollFormInputs(form) {
    // Obtain the cloned input fields for the dialog in order to update them
    var clonedFields = form.find('.formset-form-fields:first >');

    // Obtain a reference to the options table
    var table = form.find('.table:first');

    // Perform the ID updates on the fields based on the poll index
    performFormInputUpdates(clonedFields, table, pollIndex);
}

function performFormInputUpdates(fields, table, index) {
    // Update the table ID
    table.attr("id", "options-table-" + index);

    // Update the poll question / statement ID
    fields.find(".dialogQ:first")
        .attr("id", "question-name-input-" + index)
        .attr("name", "question-name-input-" + index);

    // Update one of the help block IDs for various sections of the dialog
    var pollQuestionErrorHelpBlock = fields.find("#question-input-error-block");
    pollQuestionErrorHelpBlock.attr("id", "question-input-error-block-" + index);

    var pollOptionsErrorHelpBlock = fields.find("#options-input-error-block");
    pollOptionsErrorHelpBlock.attr("id", "options-input-error-block-" + index);

    var pollSelectionsErrorHelpBlock = fields.find("#selections-input-error-block");
    pollSelectionsErrorHelpBlock.attr("id", "selections-input-error-block-" + index);

    // Update the poll option input IDs
    var optsInputs = fields.find(".dialogO");

    for(var i = 0; i < optsInputs.length; i++) {
        var input = optsInputs[i];
        input.id = "option-name-input-" + index;
        input.name = "option-name-input-" + index;
    }

    // Update the data-formset-prefix for correct referencing
    var dataFormsetPrefix = "options-" + index;
    var optionFormSet = fields.find(".option-formset");
    optionFormSet.attr("data-formset-prefix", dataFormsetPrefix);

    var addPollOptBtn = fields.find('.formset-add');
    addPollOptBtn.attr("data-formset-prefix", dataFormsetPrefix);

    // Update the poll min and max selection
    fields.find(".min-input:first")
        .attr("id", "minimum-input-" + index)
        .attr("name", "minimum-input-" + index);

    fields.find(".max-input:first")
        .attr("id", "maximum-input-" + index)
        .attr("name", "maximum-input-" + index);
}

function isDialogFormValid() {
    var pollQValid = true;
    var optsValid = true;
    var minMaxSelValid = true;

    // Check question is valid
    var pollQErrorHelpBlockId = "question-input-error-block-" + pollIndex;
    pollQValid = isPollQValid();

    if(pollQValid === true) {
        clearError(pollQErrorHelpBlockId);
    } else {
        highlightError(pollQErrorHelpBlockId);
    }

    // Check opts are valid
    var pollOptsErrorHelpBlockId = "options-input-error-block-" + pollIndex;
    optsValid = isPollOptionsValid();

    if(optsValid === true) {
        clearError(pollOptsErrorHelpBlockId);
    } else {
        highlightError(pollOptsErrorHelpBlockId);
    }

    // Check min and max selections are valid
    var pollSelErrorHelpBlockId = "selections-input-error-block-" + pollIndex;
    minMaxSelValid = isMinMaxSelectionValid();

    if(minMaxSelValid === true) {
        clearError(pollSelErrorHelpBlockId);
    } else {
        highlightError(pollSelErrorHelpBlockId);
    }

    return pollQValid && optsValid && minMaxSelValid;
}

function updateSelectionsMaxAtrr() {
    var minInput = $('#minimum-input-' + pollIndex);
    var maxInput = $('#maximum-input-' + pollIndex);

    // Get the vals from the selection inputs and update them if they exceed the new max
    var minInputVal = minInput.val();

    if(minInputVal !== '' && (minInputVal > numOfOpts)) {
        minInput.val(numOfOpts);
    }

    var maxInputVal = maxInput.val();

    if(maxInputVal !== '' && (maxInputVal > numOfOpts)) {
        maxInput.val(numOfOpts);
    }

    // Finally update the max attr to include the new total num of opts
    minInput.attr("max", numOfOpts);
    maxInput.attr("max", numOfOpts);
}

$('.formset-add').click(function (e) { // Ported from DEMOS1
    var formsetPrefix = $(this).attr('data-formset-prefix');
    var formset = $('.formset[data-formset-prefix="' + formsetPrefix + '"]');
    var emptyForm = formset.children('.formset-form-empty');
    var emptyFormCheckedInputs = emptyForm.find('input:checkbox:checked, input:radio:checked');
    var form = emptyForm.clone(true).removeClass('formset-form-empty');

    switch (formsetPrefix) {
        case "polls":
            // Set the index
            pollIndex = pollCount;

            // Update the IDs and names of all of the cloned input form fields based on the number of polls
            updatePollFormInputs(form);

            // 2 is the default number of opts shown upon the launch of the dialog
            numOfOpts = 2;

            // New poll is being created so edit mode hasn't been activated
            pollEditActive = false;
            break;
        case "options-" + pollIndex:
            numOfOpts++;
            updateSelectionsMaxAtrr();
            clearError("options-input-error-block-" + pollIndex);
            break;
    }

    var formIndex = formset.children('.formset-form:not(.formset-form-empty)').length;

    formset.append(form);
    updateForm(form, formIndex, updateModes.create);
    emptyFormCheckedInputs.each(function (index) {
        $(this).prop('checked', true);
    });
    switch (formset.attr('data-formset-type')) {
        case 'modal':
            $('#formset-modal').data('form', form).data('formAdd', true).modal('show');
            break;
        case 'inline':
            manageTotalForms(formset, +1);
            form.removeClass('hidden');
            formset.trigger('formsetFormAdded', [form]);
            break;
    }
});

$('.formset-form-remove').click(function (e) { // Ported from DEMOS1
    var form = $(this).closest('.formset-form');
    var formPrefix = form.attr('data-formset-form-prefix');
    var formset = form.parent('.formset');
    if ($('#id_' + formPrefix + '-id').val()) {
        $('#id_' + formPrefix + '-DELETE').prop('checked', true);
        form.addClass('formset-form-removed hidden');
    } else {
        form.remove();
        manageTotalForms(formset, -1);
    }

    // We need to reduce the poll count if we've removed a poll
    if(formPrefix === "poll") {
        pollCount--;
    }

    // Update the formset and inform that a form has been removed
    updateFormset(formset);
    formset.trigger('formsetFormRemoved');

    // Perform validation and other operations now that a row has been removed based on the affected table
    switch (formPrefix) {
        case 'option':
            // Decrement the number of total options and validate the options list
            numOfOpts--;
            updateSelectionsMaxAtrr();
            validateFormField(isPollOptionsValid, "options-input-error-block-" + pollIndex);
            break;
        case 'organiser':
            validateFormField(areOrganisersEmailsValid, "organisers-input-error-block");
            break;
        case 'trustee':
            validateFormField(areTrusteesEmailsValid, "trustees-input-error-block");
            break;
    }
});

$('.formset-form-save').click(function (e) {
    var dialogValid = isDialogFormValid();

    if(dialogValid === true) {
        var modal = $(this).closest('.modal');
        var form = modal.data('form');
        var name = $('#question-name-input-' + pollIndex).val();
        form.find('.formset-form-name:first').text(name);
        modal.data('formSave', true);
        modal.modal('hide');

        if(!pollEditActive) {
            // Increment the poll count and clear any validation errors
            pollCount++;
        } else {
            pollEditActive = false;
        }

        clearError("polls-input-error-block");
    }
});

function extractPollIndexFromId(id) {
    var idSplitArray = id.split('-');
    pollIndex = parseInt(idSplitArray[3]);
}

$('.formset-form-edit').click(function (e) {
    var form = $(this).closest('.formset-form');
    var questionNameInput = form.find('.formset-form-fields:first > .dialogFormField > .dialogQ');
    extractPollIndexFromId(questionNameInput.attr('id'));
    $('#formset-modal').data('form', form).modal('show');
    pollEditActive = true;
});

$('#formset-modal').on('show.bs.modal', function (e) { // Ported from DEMOS1
    var modal = $(this);
    var modalBody = modal.find('.modal-body > .row > [class^="col-"]');
    var modalTitle = modal.find('.modal-title');
    var form =  modal.data('form');
    var formset = form.parent('.formset');
    var formFields = form.find('.formset-form-fields:first >').detach();
    modal.data('formFields', formFields);

    var clonedFields = formFields.clone(true);
    modalBody.append(clonedFields);

    modalTitle.text(formset.attr('data-formset-modal-title'));
    formset.trigger('formsetModalShow', [modalBody]);

    // Attach an event handler for poll option row sorting
    $("#options-table-" + pollIndex).sortable({
        items: "tr",
        update: update
    });
});

$('#formset-modal').on('hide.bs.modal', function (e) {
    var modal = $(this);
    var modalBody = modal.find('.modal-body > .row > [class^="col-"]');
    var form = modal.data('form');
    var formset = form.parent('.formset');
    if (modal.data('formSave')) {
        var formset = form.parent('.formset');
        if (modal.data('formAdd')) {
            manageTotalForms(formset, +1);
            form.removeClass('hidden');
        }
    } else {
        if (modal.data('formAdd')) {
            form.remove();
        }
    }
    formset.trigger('formsetModalHide', [modalBody]);
});

$('#formset-modal').on('hidden.bs.modal', function (e) {
    var modal = $(this);
    var modalBody = modal.find('.modal-body > .row > [class^="col-"]');
    var form = modal.data('form');
    var formset = form.parent('.formset');
    var formFields = form.find('.formset-form-fields:first');
    if (modal.data('formSave')) {
        formFields.append(modalBody.children().detach());
        if (modal.data('formAdd')) {
            formset.trigger('formsetFormAdded', [form]);
        } else {
            formset.trigger('formsetFormEdited', [form]);
        }
    } else {
        modalBody.empty();
        if (!modal.data('formAdd')) {
            formFields.append(modal.data('formFields'));
        }
    }
    modal.find('.modal-title').text('');
    modal.removeData();
});