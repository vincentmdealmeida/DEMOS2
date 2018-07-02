"""
Django settings for allauthdemo project.

For more information on this file, see
https://docs.djangoproject.com/en/1.6/topics/settings/

For the full list of settings and their values, see
https://docs.djangoproject.com/en/1.6/ref/settings/
"""

# Build paths inside the project like this: os.path.join(BASE_DIR, ...)
import os
BASE_DIR = os.path.dirname(os.path.dirname(__file__))


# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/1.6/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = '!h8#n5wopc#7zq!_)i=l#t=q)7g0g-+&0!=kxv+*&2b7*xb8bm' # TODO: THIS NEEDS CHANGING!!!

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True

TEMPLATE_DEBUG = True

ALLOWED_HOSTS = ['web.server.com']

# Domain the application is deployed on (Needs changing for production)
# This must not include the protocol nor any trailing slashes as application code should just add this in
DOMAIN = "127.0.0.1:8000"

# Application definition

INSTALLED_APPS = (
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.sites',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    'bootstrap3', # optional module for making bootstrap forms easier
    'crispy_forms',

    'allauth',
    'allauth.account',
    'allauth.socialaccount',
    

    #'allauth.socialaccount.providers.facebook',
    #'allauth.socialaccount.providers.google',
    #'allauth.socialaccount.providers.twitter',

    # Core apps
    'allauthdemo.auth',
    'allauthdemo.polls',

    # Celery and captcha
    'kombu.transport.django',
    'djcelery',
    'captcha'

)

MIDDLEWARE_CLASSES = (
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
)

ROOT_URLCONF = 'allauthdemo.urls'

WSGI_APPLICATION = 'allauthdemo.wsgi.application'


# Database
# https://docs.djangoproject.com/en/1.6/ref/settings/#databases
'''
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': os.path.join(BASE_DIR, 'db.sqlite3'),
    }
}
'''
DATABASES = {
    'default':{
    'ENGINE': 'django.db.backends.mysql',
    'NAME':'DEMOS2',
    'USER': 'username',
    'PASSWORD' : 'password',
    'HOST': 'localhost',
    'PORT':'3306',
    }
}

SILENCED_SYSTEM_CHECKS = ['mysql.E001']

# Internationalization
# https://docs.djangoproject.com/en/1.6/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_L10N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/1.6/howto/static-files/

STATIC_URL = '/static/'

# Authentication

AUTHENTICATION_BACKENDS = (
    "allauth.account.auth_backends.AuthenticationBackend",
)

TEMPLATES = [
    {
    'BACKEND': 'django.template.backends.django.DjangoTemplates',
    'DIRS': [
        # allauth templates: you could copy this directory into your
        # project and tweak it according to your needs
        # os.path.join(PROJECT_ROOT, 'templates', 'uniform', 'allauth'),
        # example project specific templates
        os.path.join(BASE_DIR, 'allauthdemo', 'templates', 'plain', 'example'),
        #os.path.join(BASE_DIR, 'allauthdemo', 'templates', 'bootstrap', 'allauth'),
        os.path.join(BASE_DIR, 'allauthdemo', 'templates', 'allauth'),
        os.path.join(BASE_DIR, 'allauthdemo', 'templates'),
    ],
    'APP_DIRS': True,
    'OPTIONS': {
        'context_processors': [
            # needed for admin templates
            'django.contrib.auth.context_processors.auth',
            # these *may* not be needed
            'django.template.context_processors.debug',
            'django.template.context_processors.i18n',
            'django.template.context_processors.media',
            'django.template.context_processors.static',
            'django.contrib.messages.context_processors.messages',
            # allauth needs this from django
            'django.template.context_processors.request',
            # allauth specific context processors
            #'allauth.account.context_processors.account',
            #'allauth.socialaccount.context_processors.socialaccount',
          ],
       },
    }
]

MESSAGE_STORAGE = 'django.contrib.messages.storage.session.SessionStorage'

#EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
#EMAIL_PORT = 1025

EMAIL_HOST = 'smtp.gmail.com'
EMAIL_HOST_USER = 'demos2.no.reply@gmail.com'
EMAIL_HOST_PASSWORD = 'Demos2LancsUni'
EMAIL_PORT = 587
EMAIL_USE_TLS = True

STATICFILES_DIRS = (
    os.path.join(BASE_DIR, "static"),
)

SITE_ID = 1
AUTH_USER_MODEL = 'allauthdemo_auth.DemoUser'
LOGIN_REDIRECT_URL = '/member/'
ACCOUNT_AUTHENTICATION_METHOD = 'email'
ACCOUNT_USERNAME_REQUIRED = False
ACCOUNT_EMAIL_REQUIRED = True
ACCOUNT_USERNAME_MIN_LENGTH = 3
# ACCOUNT_EMAIL_VERIFICATION = 'none'  # testing...
ACCOUNT_USER_MODEL_USERNAME_FIELD = None
SOCIALACCOUNT_AUTO_SIGNUP = False  # require social accounts to use the signup form ... I think
ACCOUNT_SIGNUP_FORM_CLASS = 'allauthdemo.auth.forms.RegistrationForm'

# For custom sign-up form:
# http://stackoverflow.com/questions/12303478/how-to-customize-user-profile-when-using-django-allauth

# Google reCAPTCHA

RECAPTCHA_PUBLIC_KEY = '6Ld1Z10UAAAAAG1ExO-I-AivOvQqakHIkYwu5adT'
RECAPTCHA_PRIVATE_KEY = '6Ld1Z10UAAAAAG3-XrkE3Ds0FnKIOa3LloA6wI14'
NOCAPTCHA = True # v2 (no puzzle, just click)

# crispy_forms

CRISPY_FAIL_SILENTLY = not DEBUG
CRISPY_TEMPLATE_PACK = 'bootstrap3'



CELERY_RESULT_BACKEND='djcelery.backends.database:DatabaseBackend'
BROKER_URL = 'django://'
