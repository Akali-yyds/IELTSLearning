git rm --cached backend/data/stardict.db
echo "backend/data/stardict.db" >> .gitignore
git add .gitignore
git commit --amend --no-edit
git push
