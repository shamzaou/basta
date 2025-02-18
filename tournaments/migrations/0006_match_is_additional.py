from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('tournaments', '0005_alter_player_nickname_alter_player_unique_together'),
    ]

    operations = [
        migrations.AddField(
            model_name='match',
            name='is_additional',
            field=models.BooleanField(default=False),
        ),
    ]
