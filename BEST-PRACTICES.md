# HSCI data-centric repository template and guidelines

## Repository layout

Put all data under `data`, all code under `src`. Track everything under `data` in [git LFS](https://git-lfs.github.com/).

Under `data`, the `data/input` folder is to contain all data that comes to the project from outside. If it comes from a git repository, use git submodules to import it. If the data is over about 500MB in size, do not include it, but instead add a `README.md` that points to it in e.g. [Allas](https://docs.csc.fi/data/Allas/).

All data produced by code should go either into `data/work` or `data/output`. If the purpose of the repo is to produce a unified clean dataset, put the files part of that into `data/output`, and make that directory its own git repo and a submodule. This way, downstream analysis repos can import only the clean data and not the code, input or other cruft.

Files that are clearly just intermediate/temporary steps in the process should be put under `data/work`. Mostly do not commit this directory or the files in it into git. The exception is if reproducing them takes a long time, or if you think they're otherwise useful (but then maybe they don't belong under `work` in the first place).

Everything under `data/work` and `data/output` should in principle be automatically regenerateable from what is in `data/input`. If there needs to be some manually created data in `data/output`, two choices are available:

1. Put this data in `data/input` and have the `Makefile` or equivalent copy it under `data/output`.
2. Document clearly which parts of `data/output` are not regenerateable.

If hand-curation of data is necessary, the best practice for this is to employ patch files added to `data/input` that document entries to be amended, what to remove and what to add and so on. This way, these patches can be re-applied to new data coming in, while also maintaining a clear record of what has been manually changed, further improving reproducibility and rerunnability.

If the repository has multiple people experimenting with different things in it that are liable to make the repo a mess (e.g. exploratory analyses), partition both code and data into subdirectories by username, e.g. `src/analysis/jiemakel`, `data/work/jiemakel` and so on, so that each person is free to make a mess only in their subpart of the project, where they'll hopefully remember what's what.

For analysis repositories, create a common basis that loads/prepares access to a unified common source data set, so that everyone is operating with a shared common version of the data. Name this e.g. `src/common_basis.R` and call it from e.g. the analysis notebooks to load the data.

## Naming conventions

In data file columns as well as code variable and function names, use primarily `_` as a separator. E.g. `document_id`, not `documentId`, `parse_document_id` not `parseDocumentId`. For filenames, either `parse-document-ids.py` or `parse_document_ids.py` is permissible, but please be consistent within a single project.

## Coding conventions

- When using Python, try to follow [pep8](https://www.python.org/dev/peps/pep-0008/). [autopep8](https://pypi.org/project/autopep8/) and a matching editor plugin/[pre-commit-hook](https://pre-commit.com/) or equivalent support will help in this.
- When using R, prefer [tidyverse](https://www.tidyverse.org/packages/) functions to base R. Also try to follow the [tidyverse style guide](https://style.tidyverse.org/). [styler](https://styler.r-lib.org/) and a matching editor plugin/[pre-commit-hook](https://pre-commit.com/) or equivalent support will help.
- It is desireable to have a `Makefile` or equivalent in the project, through which we can track what code produces what data and through which we can also rerun the pipelines
- Generally, try to make sure there is an easy way by which all the dependencies of a project can be installed. To ensure this, prefer isolated project environments.
  - For managing dependencies in Python projects, prefer using [uv](https://docs.astral.sh/uv/).
  - For managing dependencies in R, prefer using [rv](https://a2-ai.github.io/rv-docs/).
  - For projects combining Python and R, use both.
  - Don't commit the env directories created by the above tools to git, instead just commit the definition/lock files.
- Using notebooks is ok, but:
  - Try to ensure dependency management is still sensible
  - For Python, prefer `#%%` style in plain `.py` files instead of `.ipynb` (see e.g. [Scientific Tools for PyCharm](https://www.jetbrains.com/pycharm/features/scientific_tools.html), [Python Interactive window in VSCode](https://code.visualstudio.com/docs/python/jupyter-support-py) or [Jupytext for Jupyter Notebook](https://github.com/mwouts/jupytext)).
  - For R, prefer `.Rmd` to `.ipynb`.
  - If storing cell outputs is desired (e.g. for analysis repositories), for R store an `.nb.html` alongside the `.Rmd` (RStudio does this automatically when the notebook type is set to [`html_notebook`](https://bookdown.org/yihui/rmarkdown/notebook.html)) and for Python, store an `.ipynb` alongside (You can use [Jupytext](https://github.com/mwouts/jupytext) to keep these in sync. Automated syncing is enabled in Jupyter by 1) installing the jupytext extension and 2) [adding](https://github.com/mwouts/jupytext/blob/main/docs/paired-notebooks.md) the appropriate metadata to the files)

## Data conventions

- Store data as TSV files with the `.tsv` file extension. Use `"` as the quote character, and quote character doubling as the escape method. Quote output only when necessary. Encode missing values as the empty string (not `NA` from R)
- If the file size of your uncompressed TSV file is over about 150MB, gzip the file into a `.tsv.gz`.
- If you are storing larger datasets, use zstd compressed [Parquet](https://parquet.apache.org/docs/).
- For naming columns, use English, unless the number of columns is large and comes from an external source, making translating them too costly.
- If you have multiple tables, make sure column names are unique across all of them. So e.g. if both books as well as people have names, use `book_name` in the book table and `person_name` in the person table instead of using just `name` in both.
- Organize data using [tidy data](https://cran.r-project.org/web/packages/tidyr/vignettes/tidy-data.html) principles.
- Unless it is **blatantly** obvious from the file and column names (it never is), include a README file giving an explanation of what each data field contains and how the different files fit together. Also link each file to what creates it, be that a pipeline or an external source (see also above on reproducibility/Makefiles).
- For parsed date and datetime fields, use [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601) (`YYYY-MM-DD` and `YYYY-MM-DDThh:mm:ss[Z]`). For datetimes, if possible use Coordinated Universal Time by first giving the local datetime and then the UTC offset, so e.g. midnight Helsinki time should be encoded as `00:00:00+02:00` or `00:00:00+03:00` depending on Daylight Saving Time instead of `22:00:00Z` or `21:00:00Z`. If resolving times to UTC is too hard, just stick to local time and don't give an UTC offset.
- If your data contains one-to-many or many-to-many relations, generally follow relational modeling principles, with one-to-one core attribute tables for the entries, and separate link tables encoding the one-to-many and many-to-many relations. Particularly, no cross-product tables that duplicate attributes. See further below.

### Handling multiple attribute values / one-to-many / many-to-many relations

If an attribute may have multiple values, in general, prefer long format separate tables:

```tsv
person_id   book_id role
person_1    book_1  author
person_1    book_1  publisher
```

In some situations, it is permissible to instead put multiple values in the same field. In these cases, use `|` as the separator.

```tsv
person_id   person_first_name   person_last_name roles
person_1    John                Doe              author|publisher
```

The situations in which this is permissible are when there are many core attributes associated with the entity, of which only one or two may contain multiple values, and it would feel stupid to extract only those into a separate table.

Never duplicate values unnecessarily by e.g. creating cross-product tables like the following:

```tsv
person_id   person_name book_id role
person_1    John Doe    book_1  author
person_1    John Doe    book_1  publisher
```

Instead, have two tables:

```tsv
person_id   person_name
person_1    John Doe
```

and

```tsv
person_id   book_id role
person_1    book_1  author
person_1    book_1  publisher
```

## Reproducibility

- Repeat from above: everything that is output from the project should in principle be automatically regenerateable from what comes in to the project. This enforces repeatability of the research process and makes its validation possible, while also making it able to be re-run for inevitably changing inputs.
- If an analysis repo ends up as an article, at the point of submission, clearly separate final code (e.g. code producing the final figures used in the article) from other code. You can do this either by moving these to separate files, or by clearly flagging the relevant parts of a larger notebook file. The important bit is that it must be clear to an outsider which code path leads to reproducing the results in the article.
- At this point, also make sure that it is possible to run the code from a fresh checkout (e.g. make sure dependency management works).
- Make sure that both the code repo as well as all repositories it depends on for either data or code are versioned and those versions archived (e.g. by [linking the repositories to Zenodo](https://docs.github.com/en/repositories/archiving-a-github-repository/referencing-and-citing-content) and creating versioned releases from them)
