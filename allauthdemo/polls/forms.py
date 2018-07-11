from functools import partial
from django import forms
from django.core.validators import MinLengthValidator
from django.template.loader import render_to_string
from django.template import Context
from django.core.exceptions import ValidationError
from django.core.validators import EmailValidator
from django.core.mail import send_mail
from crispy_forms.helper import FormHelper
from crispy_forms.layout import LayoutObject, Layout, TEMPLATE_PACK, Fieldset, ButtonHolder, Submit, Div, Field, HTML
from crispy_forms.bootstrap import StrictButton, TabHolder, Tab, FormActions, PrependedText, PrependedAppendedText, Accordion, AccordionGroup
from captcha.fields import ReCaptchaField
from allauthdemo.auth.models import DemoUser
from .models import Event, Poll, PollOption

def is_valid_email(email):
    try:
        valid_email = EmailValidator()
        valid_email(email)
        return True
    except ValidationError:
        return False

class EventForm(forms.ModelForm):
    #trustees = forms.CharField(label="Trustee list", widget=forms.Textarea(attrs={'width':"100%", 'cols' : "80", 'rows': "20", }))
    voters = forms.CharField(label="Voters", required=False, widget=forms.Textarea(attrs={'width':"100%", 'cols' : "80", 'rows': "20", }))
    #self.voters.widget=forms.Textarea(attrs={'width':"100%", 'cols' : "80", 'rows': "20", })
    votersTextFile = forms.FileField(required=False)
    captcha = ReCaptchaField()
    def __init__(self, *args, **kwargs):
        self.helper = FormHelper()
        self.helper.form_tag = False
        self.helper.form_show_labels = False
        self.helper.layout = Layout(
            Accordion(
                AccordionGroup('Event Details',
                    PrependedText('title', 'Title', placeholder="Title of the Event"),
                    Div(
                        PrependedAppendedText('start_time', 'Begins', '<span class="glyphicon glyphicon-calendar"></span>', placeholder="dd/mm/yyyy hh:mm"),
                            css_class="input-group date col-sm-6"
                    ),
                    Div(
                        PrependedAppendedText('end_time', 'Ends', '<span class="glyphicon glyphicon-calendar"></span>', placeholder="dd/mm/yyyy hh:mm"),
                            css_class="input-group date col-sm-6"
                    ),
                    Field('captcha')
                ),
                AccordionGroup("Organisers",
                    HTML("<p>Event creators are automatically made an Organiser. Click and drag the tabs to reorder. Blank fields will be ignored.</p>"),
                    Formset("organiser_formset",
                        "polls/create_option.html",
                        OrganiserFormSetHelper()
                    ),
                ),
                AccordionGroup('Trustees',
                    HTML("<p>Click and drag the tabs to reorder. Blank fields will be ignored.</p>"),
                    Formset("trustee_formset",
                        "polls/create_option.html",
                        TrusteeFormSetHelper()
                    ),
                ),
                AccordionGroup('Voters',
                    'voters',
                    HTML("<p>Comma seperated (.csv) file of valid email addresses</p>"),
                    'votersTextFile'
                ),
            ),
        )
        super(EventForm, self).__init__(*args, **kwargs)

    class Meta:
        model = Event
        fields = ('title', 'start_time', 'end_time', 'captcha') # TWEAK!!!
        widgets = {
            'voters': forms.Textarea(attrs={'cols': 80, 'rows': 20})
        }

class EventEditForm(forms.ModelForm):
    #trustees = forms.CharField(label="Trustee list", widget=forms.Textarea(attrs={'width':"100%", 'cols' : "80", 'rows': "20", }))
    voters = forms.CharField(label="Voters", required=False, widget=forms.Textarea(attrs={'width':"100%", 'cols' : "80", 'rows': "20", }))
    #self.voters.widget=forms.Textarea(attrs={'width':"100%", 'cols' : "80", 'rows': "20", })
    votersTextFile = forms.FileField(required=False)
    captcha = ReCaptchaField()
    def __init__(self, *args, **kwargs):
        self.helper = FormHelper()
        self.helper.form_tag = False
        self.helper.form_show_labels = False
        self.helper.layout = Layout(
            Accordion(
                AccordionGroup('Event Details',
                    PrependedText('title', 'Title', placeholder="Title of the Event"),
                    Div(
                        PrependedAppendedText('start_time', 'Begins', '<span class="glyphicon glyphicon-calendar"></span>', placeholder="dd/mm/yyyy hh:mm"),
                            css_class="input-group date col-sm-6"
                    ),
                    Div(
                        PrependedAppendedText('end_time', 'Ends', '<span class="glyphicon glyphicon-calendar"></span>', placeholder="dd/mm/yyyy hh:mm"),
                            css_class="input-group date col-sm-6"
                    ),
                    Field('captcha')
                ),
                AccordionGroup('Voters',
                    'voters',
                    HTML("<p>Comma seperated (.csv) file of valid email addresses</p>"),
                    'votersTextFile'
                ),
            ),
        )
        super(EventEditForm, self).__init__(*args, **kwargs)

    class Meta:
        model = Event
        fields = ('title', 'start_time', 'end_time', 'captcha') # TWEAK!!!
        widgets = {
            'voters': forms.Textarea(attrs={'cols': 80, 'rows': 20})
        }



class EventSetupForm(forms.Form):
    public_key = forms.CharField(max_length=1024, required=True)

    def __init__(self, *args, **kwargs):
        self.helper = FormHelper()
        self.helper.form_tag = False
        self.helper.form_show_labels = False
        self.helper.layout = Layout(
            Field('public_key', id="public-key")
        )
        super(EventSetupForm, self).__init__(*args, **kwargs)

    class Meta:
        fields = ('public_key',)

class PollForm(forms.ModelForm):
    question_text = forms.CharField(
        max_length = 80,
        required = True,
    )
    def __init__(self, *args, **kwargs):
        option_formset = kwargs.pop('option_formset', None)
        choices = option_formset.total_form_count() if option_formset else 2
        self.helper = FormHelper()
        self.helper.form_show_labels = False
        self.helper.form_tag = False
        self.helper.layout = Layout(
            Accordion(
                AccordionGroup("Poll Details",
                    PrependedText('question_text', 'Question', placeholder='The question or title of your poll')
                ),
                AccordionGroup("Poll Options",
                    HTML("<p>Click and drag the tabs to reorder</p>"),
                    Formset("option_formset",
                        "polls/create_option.html",
                        PollOptionFormSetHelper()
                    )
                )
            ),
        )
        super(PollForm, self).__init__(*args, **kwargs)

    class Meta:
        model = Poll
        fields = ('question_text',)

class VoteModelChoiceField(forms.ModelChoiceField):
    def label_from_instance(self, obj):
         return obj.choice_text

class VoteForm(forms.ModelForm):
    cipher_text_c1 = forms.CharField(
        max_length = 1024,
        required = True,
    )
    cipher_text_c2 = forms.CharField(
        max_length = 1024,
        required = True,
    )
    def __init__(self, *args, **kwargs):
        super(VoteForm, self).__init__(*args, **kwargs)
        self.helper = FormHelper(self)
        self.helper.form_show_labels = False
        self.helper.form_tag = False
        self.helper.layout = Layout(
            Field('cipher_text_c1', type="hidden"),
            Field('cipher_text_c2', type="hidden")
            )

    class Meta:
        model = Poll
        fields = ()#'options')

class DecryptionForm(forms.Form):
    text = forms.CharField(max_length=1024, required=True)
    def __init__(self, *args, **kwargs):
        super(DecryptionForm, self).__init__(*args, **kwargs)
        self.helper = FormHelper(self)
        self.helper.form_show_labels = False
        self.helper.form_tag = False
        self.layout = Layout(
            PrependedText('text', 'Cipher'),
        )

    class Meta:
        model = Poll
        fields = ('enc',)#'options')

class EmailForm(forms.Form):
    email = forms.CharField(
        max_length = 80,
        required = True,
    )

    def __init__(self, *args, **kwargs):
        super(EmailForm, self).__init__(*args, **kwargs)

    def clean_email(self):
        email = self.cleaned_data['email']
        if is_valid_email(email):
            return email
        raise forms.ValidationError(u'This doesn\'t appear to be a valid email address.')

class OrganiserForm(EmailForm):

    def clean_email(self):
        email = self.cleaned_data['email']
        if is_valid_email(email):
            if DemoUser.objects.filter(email=email).exists():
                return email
            raise forms.ValidationError(u'User "%s" does not exist.' % email)
        raise forms.ValidationError(u'This doesn\'t appear to be a valid email address.')

class BaseFormSetHelper(FormHelper):
    def __init__(self, *args, **kwargs):
        super(BaseFormSetHelper, self).__init__(*args, **kwargs)
        self.form_method = 'post'
        self.form_show_labels = False
        self.form_tag = False
        self.layout = Layout()
        #Field('organiser_email', placeholder="Option here")
        self.render_required_fields = True

class OrganiserFormSetHelper(BaseFormSetHelper):
    def __init__(self, *args, **kwargs):
        super(OrganiserFormSetHelper, self).__init__(*args, **kwargs)
        self.layout = Layout(
            Div(
                Field('DELETE', css_class='input-small hidden'),
                PrependedAppendedText('email', 'Email ', "<span data-toggle='tooltip' title='Delete this Organiser' class='glyphicon glyphicon-trash'></span>", placeholder="Email address of the organiser"),
            css_class="formset_object")
        )

class DecryptionFormSetHelper(BaseFormSetHelper):
    def __init__(self, *args, **kwargs):
        super(DecryptionFormSetHelper, self).__init__(*args, **kwargs)
        self.form_show_labels = False
        self.layout = Layout(
            Div(
                PrependedText('text', 'Cipher '),
            css_class="formset_object")
        )

class TrusteeFormSetHelper(BaseFormSetHelper):
    def __init__(self, *args, **kwargs):
        super(TrusteeFormSetHelper, self).__init__(*args, **kwargs)
        self.layout = Layout(
            Div(
                Field('DELETE', css_class='input-small hidden'),
                PrependedAppendedText('email', 'Email ', "<span data-toggle='tooltip' title='Delete this Trustee' class='glyphicon glyphicon-trash'></span>", placeholder="Email address of the trustee"),
            css_class="formset_object")
        )

class PollOptionFormSetHelper(BaseFormSetHelper):
    def __init__(self, *args, **kwargs):
        super(PollOptionFormSetHelper, self).__init__(*args, **kwargs)
        self.layout = Layout(
            Div(
                Field('DELETE', css_class='input-small hidden'),
                PrependedAppendedText('choice_text', 'Option', "<span class='glyphicon glyphicon-trash'></span>", placeholder="Option"),
            css_class="formset_object")
        )

class PollOptionFormSetHelper(BaseFormSetHelper):
    def __init__(self, *args, **kwargs):
        super(PollOptionFormSetHelper, self).__init__(*args, **kwargs)
        self.layout = Layout(
            Div(
                Field('DELETE', css_class='input-small hidden'),
                PrependedAppendedText('choice_text', 'Option', "<span class='glyphicon glyphicon-trash'></span>", placeholder="Option"),
            css_class="formset_object")
        )

### EXPERIMENTAL  https://stackoverflow.com/questions/15157262/django-crispy-forms-nesting-a-formset-within-a-form/22053952#22053952
class Formset(LayoutObject):
    """
    Layout object. It renders an entire formset, as though it were a Field.

    Example::

    Formset("attached_files_formset")
    """

    template = "%s/formset.html" % TEMPLATE_PACK

    def __init__(self, formset_name_in_context, template=None, helper=None):
        self.formset_name_in_context = formset_name_in_context

        # crispy_forms/layout.py:302 requires us to have a fields property
        self.fields = []

        # Overrides class variable with an instance level variable
        if template:
            self.template = template

        if helper:
            self.helper = helper

    def render(self, form, form_style, context, template_pack=TEMPLATE_PACK):
        formset = context[self.formset_name_in_context]
        return render_to_string(self.template, Context({'wrapper': self,
            'formset': formset, 'helper': self.helper}))

class OptionForm(forms.ModelForm):

    choice_text = forms.CharField(label=('Option'),
        min_length=1, max_length=1024)

    def clean_option(self):
        return _trim_whitespace(self.cleaned_data['text'])

    class Meta:
        model = PollOption
        fields = ('choice_text',)

OrganiserFormSet = forms.formset_factory(form=OrganiserForm, extra=0, min_num=1, max_num=10, can_delete=True)
TrusteeFormSet = forms.formset_factory(form=EmailForm, extra=1, min_num=1, max_num=10, can_delete=True)
DecryptionFormset = forms.formset_factory(form=DecryptionForm, extra=0, min_num=0, validate_min=True, max_num=20, can_delete=False)

OptionFormset = forms.inlineformset_factory(Poll, PollOption, form=OptionForm, min_num=2, max_num=20, validate_min=True, extra=0, fields=('choice_text',), can_delete=True)
QuestionFormset = forms.inlineformset_factory(Event, Poll, form=PollForm, extra=0, min_num=2, validate_min=True, max_num=20, can_delete=True)

"""
PartialQuestionFormSet = partial(forms.formset_factory, PollQuestionForm, extra=2,
  validate_min=True, validate_max=True, min_num=1, max_num=10)


OptionFormset = forms.inlineformset_factory(PollQuestion, QuestionChoice, extra=3, fields=('choice_text',))

QuestionFormset = forms.inlineformset_factory(Poll, PollQuestion,
                                formset=BasePollQuestionFormset, extra=2, fields=('question_text',))


TenantFormset = forms.inlineformset_factory(Building, Tenant, extra=1, fields=('name',))
BuildingFormset = forms.inlineformset_factory(Block, Building,
                                formset=BaseBuildingFormset, extra=1, fields=('address',))
    AccordionGroup('Poll Questions',
        Formset("question_formset",
            "polls/create_question.html"
        )
    ),
"""
"""

class PollQuestionForm(forms.ModelForm):
    question_text = forms.CharField(
        label = "Poll Title",
        max_length = 80,
        required = True,
    )
    def __init__(self, *args, **kwargs):
        self.helper = FormHelper()
        self.helper.form_tag = False
        self.helper.layout = Layout(
            TabHolder(
                Tab('question_text')
            ),
        )
        super(PollQuestionForm, self).__init__(*args, **kwargs)

    class Meta:
        model = PollQuestion
        fields = ('question_text',)
"""
