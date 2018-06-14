// Form submission and validation
var submitBtn = $("#submit-event-create");
var submitBtnLabel = "Create Event";
var submitBtnWaitLabel = "Please wait...";
var submitBtnErrLabel = "Errors Found";
var dateRegex = /^[0-9]{4}-(((0[13578]|(10|12))-(0[1-9]|[1-2][0-9]|3[0-1]))|(02-(0[1-9]|[1-2][0-9]))|((0[469]|11)-(0[1-9]|[1-2][0-9]|30)))\s[0-9]?[0-9]:[0-9]{2}\s\+[0-9]{2}:[0-9]{2}$/;
var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
var reCaptchaValid = false;
var generalErrorBlock = document.getElementById('all-errors-help-block');

var errors = [];

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
    var pollOptsValid = isPollAndOptsValid();
    var organisersEmailsValid = areOrganisersEmailsValid();
    var trusteesEmailsValid = areTrusteesEmailsValid();
    var votersListValid = isVotersListValid();

    return nameValid && slugValid && voteStartValid && voteEndValid && pollOptsValid
        && organisersEmailsValid && trusteesEmailsValid && votersListValid;
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
        var event_name = $('#name-input').val();

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
    var end_date_time = $('#vote-end-input').val();
    var valid = isDateValid(end_date_time);

    if(valid === false) {
        checkAndAddError({
            error: "The voting end date and time format is invalid.",
            helpBlockId: "vote-end-input-error-block"
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

function isDateValid(date_time) {
    return dateRegex.test(date_time);
}

function isPollAndOptsValid() {
    var pollValid = true;
    var optsValid = true;
    var minMaxSelValid = true;

    // Check question is valid
    pollValid = isPollValid();

    // Check opts are valid
    optsValid = isPollOptionsValid();

    // Check min and max selections are valid
    minMaxSelValid = isMinMaxSelectionValid();

    return pollValid && optsValid && minMaxSelValid;
}

function isPollValid() {
    var valid = true;

    // Check question is valid
    var question = $('#question-input').val();

    if(question === '') {
        checkAndAddError({
            error: "Question / Statement for the poll is blank.",
            helpBlockId: "question-input-error-block"
        });

        valid = false;
    }

    return valid;
}

function isPollOptionsValid() {
    var valid = true;
    var optsInputs = $('.option-formset #option-name-input');
    var helpBlockId = "options-input-error-block";

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

$('#question-input').on('input', function (e) {
    validateFormField(isPollValid, "question-input-error-block");
});

$('.option-formset #option-name-input').on('input', function(e) {
   validateFormField(isPollOptionsValid, "options-input-error-block");
});

function isMinMaxSelectionValid() {
    var valid = true;
    var minInput = $('#minimum-input');
    var minInputMinAttr = parseInt(minInput[0].min);
    var minInputVal = minInput.val();
    var helpBlockId = "selections-input-error-block";
    var errorStr = "";

    if(minInputVal < minInputMinAttr) {
        errorStr = "The minimum option selection cannot be less than " + minInputMinAttr;
        valid = false;
    }

    var maxInput = $('#maximum-input');
    var maxInputMinAttr = parseInt(maxInput[0].min);
    var maxInputVal = maxInput.val();

    if(maxInputVal < maxInputMinAttr) {
        if(errorStr !== '') {
            errorStr = errorStr + " and the maximum cannot be less than " + maxInputMinAttr;
        } else {
            errorStr = "The maximum option selection cannot be less than " + maxInputMinAttr;
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

$('#minimum-input, #maximum-input').on('input', function(e) {
   validateFormField(isMinMaxSelectionValid, "selections-input-error-block");
});

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
    var votersInputVal = $('#voters-list-input').val();

    // Check if the text area is blank
    if(votersInputVal === '') {
        checkAndAddError({
            error: "The voters list is blank.",
            helpBlockId: "voters-input-error-block"
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
                helpBlockId: "voters-input-error-block"
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
           helpBlockId: "voters-input-error-block"
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

document.getElementById('files').addEventListener('change', processFileChange, false);

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

$("#options-input-table, #organisers-input-table, #trustees-input-table").sortable({
    items: "tr",
    update: update
});


function updateFormset(formset) { // Ported from DEMOS 1. Updates the row number for the # and performs any removals.
    var forms = formset.children('.formset-form:not(.formset-form-empty, .formset-form-removed)');
    var removedForms = formset.children('.formset-form.formset-form-removed');
    forms.each(function(index) {
        updateForm($(this), index);
    });
    removedForms.each(function(index) {
        updateForm($(this), forms.length + index);
    });
}

function updateForm(form, formIndex) { // Ported from DEMOS 1.
    // Specific update for option forms
    var mayBeTextInput = form.find('input:text')[0];
    if(mayBeTextInput.placeholder !== undefined) {
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

$('.formset-add').click(function (e) { // Ported from DEMOS1
    var formsetPrefix = $(this).attr('data-formset-prefix');
    var formset = $('.formset[data-formset-prefix="' + formsetPrefix + '"]');
    var emptyForm = formset.children('.formset-form-empty');
    var emptyFormCheckedInputs = emptyForm.find('input:checkbox:checked, input:radio:checked');
    var form = emptyForm.clone(true).removeClass('formset-form-empty');
    var formIndex = formset.children('.formset-form:not(.formset-form-empty)').length;

    formset.append(form);
    updateForm(form, formIndex);
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
    updateFormset(formset);
    formset.trigger('formsetFormRemoved');
});