# news-tab

if install the component from local, zip it this way

```
cd news-tab
find . -name ".DS_Store" -delete && rm -f ../news-tab.zip && zip -r ../news-tab.zip about.json settings.yml common javascripts && unzip -l ../news-tab.zip | sed -n '1,140p'
```
