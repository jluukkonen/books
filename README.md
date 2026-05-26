# Introduction

See [BEST-PRACTICES.md](BEST-PRACTICES.md) for repository layout and coding best practices. Particularly, this repository has been setup to use [uv](https://docs.astral.sh/uv/) for Python dependency management and [rv](https://a2-ai.github.io/rv-docs/) for R dependency management.

Thus, to get the project running, do the following:

1. Ensure you have compatible versions of uv and rv available on the system.
2. Install R dependencies with `rv sync'`
3. Install Python dependencies with `uv sync`

For quick-start introductions on how to use the data in practice from code, look at [`src/jiemakel/sample_notebook.Rmd`](src/jiemakel/sample_notebook.Rmd) and[`src/jiemakel/sample_notebook.ipynb`](src/jiemakel/sample_notebook.ipynb).


Online page: https://jluukkonen.github.io/books/
