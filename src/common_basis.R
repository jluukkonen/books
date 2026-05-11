

db_params <- yaml::read_yaml(here::here("db_secret.yaml"))

con <- DBI::dbConnect(
  adbi::adbi("adbcflightsql::adbcflightsql"),
  uri = db_params$uri,
  username = db_params$username,
  password = db_params$password
)

dplyr::tbl(con, dplyr::sql("SELECT * FROM duckdb_views()")) |>
  dplyr::filter(schema_name=="books") |>
  dplyr::pull(view_name) |>
  purrr::walk(\(view) {
    t <- box::topenv()
    t[[view]] <- dplyr::tbl(con, dbplyr::in_schema("books", view))
  }, .progress=TRUE)
