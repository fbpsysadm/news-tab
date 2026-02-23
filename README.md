# news-tab

if install the component from local, zip it this way

```
cd news-tab
find . -name ".DS_Store" -delete && rm -f ../news-tab.zip 
zip -r ../news-tab.zip about.json common javascripts readme.txt 
unzip -l ../news-tab-try.zip | sed -n '1,120p'
```
