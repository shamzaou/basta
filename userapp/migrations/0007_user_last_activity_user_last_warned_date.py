# Generated by Django 4.2.19 on 2025-03-07 22:30

from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ("userapp", "0006_user_friends"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="last_activity",
            field=models.DateTimeField(default=django.utils.timezone.now),
        ),
        migrations.AddField(
            model_name="user",
            name="last_warned_date",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
