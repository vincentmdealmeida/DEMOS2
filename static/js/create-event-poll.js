// Form submission and validation
var submitBtn = $("#submit-event-create");
var dateRegex = /^[0-9]{4}-(((0[13578]|(10|12))-(0[1-9]|[1-2][0-9]|3[0-1]))|(02-(0[1-9]|[1-2][0-9]))|((0[469]|11)-(0[1-9]|[1-2][0-9]|30)))\s[0-9]{2}:[0-9]{2}\s\+[0-9]{2}:[0-9]{2}$/;
var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
var reCaptchaValid = false;

$("#election-form").submit(function(e) {
    // Intercept submission of form and temporarily suspend it
    e.preventDefault();
    var form = this;

    // Get a reference to the submit button
    submitBtn.prop('disabled', true);
    submitBtn.val('Please wait...');

    // Disable the cancel button during validation
    var cancelBtn = $("#cancel-event-create");
    cancelBtn.prop('disabled', true);

    // Perform input validation
    var formDataValid = isFormValid();

    if( formDataValid === true ) {
        form.submit();
    } else {
        submitBtn.val('Errors Found');
        cancelBtn.removeAttr('disabled');
    }
});

function isFormValid() {
    var nameValid = isNameValid();
    var slugValid = isSlugValid();
    var voteStartValid = isVoteStartValid();
    var voteEndValid = isVoteEndValid();
    var pollOptsValid = arePollsAndOptsValid();
    var minSelectionValid = isMinSelectionValid();
    var maxSelectionValid = isMaxSelectionValid();
    var organisersEmailsValid = areOrganisersEmailsValid();
    var trusteesEmailsValid = areTrusteesEmailsValid();
    var votersListValid = isVotersListValid();
    var reCaptchaValid = isReCaptchaStillValid();

    return nameValid && slugValid && voteStartValid && voteEndValid
            && pollOptsValid && minSelectionValid && maxSelectionValid
            && organisersEmailsValid && trusteesEmailsValid && votersListValid
            && reCaptchaValid;
}

function isNameValid() {
    // Based on a list of names supplied
    return true;
}

function isSlugValid() {
    return true;
}

function isVoteStartValid() {
    var start_date_time = $('#vote-start-input').val();
    return isDateValid(start_date_time);
}

function isVoteEndValid() {
    var end_date_time = $('#vote-end-input').val();
    return isDateValid(end_date_time);
}

function isDateValid(date_time) {
    return dateRegex.test(date_time);
}

function arePollsAndOptsValid() {
    // Future validation could be added here
    return true;
}

function isMinSelectionValid() {
    return true;
}

function isMaxSelectionValid() {
    return true;
}

function areOrganisersEmailsValid() {
    return true;
}

function areTrusteesEmailsValid() {
    return true;
}

function isVotersListValid() {
    return true;
}

function isReCaptchaStillValid() {
    return true;
}

$('.input-control').on('input', function(e) {
    if(reCaptchaValid === true) {
        submitBtn.val('Create Event');
        submitBtn.removeAttr('disabled');
    }
});

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

                    $('#voters-list-input').html(emails.join(', '));
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
    // TODO: call isFormValid before doing this and highlighting errors if any found
    reCaptchaValid = true;
    submitBtn.removeAttr('disabled');
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
    if(mayBeTextInput.placeholder !== undefined
        && mayBeTextInput.placeholder.indexOf("Candidate") > -1) {
        mayBeTextInput.placeholder = "Example: Candidate " + (formIndex + 1);
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