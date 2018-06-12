from django.contrib import admin

# Register your models here.

from allauthdemo.auth.models import DemoUser
from .models import Event, PollOption, Poll, Organiser

"""

from .models import Question, Choice

class ChoiceInline(admin.TabularInline):
    model = Choice
    extra = 3


class QuestionAdmin(admin.ModelAdmin):
    fieldsets = [
        (None,               {'fields': ['question_text']}),
        ('Date information', {'fields': ['pub_date'], 'classes': ['collapse']}),
    ]
    inlines = [ChoiceInline]
    list_display = ('question_text', 'pub_date', 'was_published_recently')
    list_filter = ['pub_date']
    search_fields = ['question_text']
"""

class PollAdminInline(admin.TabularInline):
    model = Poll

class PollOptionAdminInline(admin.TabularInline):
    model = PollOption

class EventAdmin(admin.ModelAdmin):
    list_display = ("title",)
    filter_horizontal = ('users_organisers', 'users_trustees')

class PollAdmin(admin.ModelAdmin):
    inlines = [PollOptionAdminInline]
    list_display = ("question_text",)

admin.site.register(Event, EventAdmin)
admin.site.register(Poll, PollAdmin)
