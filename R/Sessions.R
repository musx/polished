

#' Sessions
#'
#' R6 class to track the polished sessions
#'
#' @export
#'
#' @importFrom R6 R6Class
#' @importFrom httr GET content warn_for_status
#' @importFrom jsonlite fromJSON
#' @importFrom digest digest
#' @importFrom DBI dbGetQuery dbWithTransaction dbExecute
#'
Sessions <-  R6::R6Class(
  classname = "Sessions",
  public = list(
    app_name = character(0),
    firebase_functions_url = character(0),
    conn = NULL,
    config = function(app_name, firebase_functions_url = NULL, conn = NULL, authorization_level = "app") {

      self$app_name <- app_name
      self$firebase_functions_url <- firebase_functions_url
      self$conn <- conn
      private$authorization_level <- authorization_level

      invisible(self)
    },
    sign_in = function(firebase_token, token) {
      conn <- self$conn
      # firebase function callable via url
      url_out <- paste0(self$firebase_functions_url, "sign_in_firebase")
      response <- httr::GET(
        url_out,
        query = list(
          token = firebase_token
        )
      )

      httr::warn_for_status(response)
      user_text <- httr::content(response, "text")
      user <- jsonlite::fromJSON(user_text)

      new_session <- NULL

      if (!is.null(user)) {

        new_session <- list(
          email = user$email,
          firebase_uid = user$user_id,
          email_verified = user$email_verified
        )

        tryCatch({
          # confirm that user is invited
          invite <- self$get_invite_by_email(new_session$email)

          # find the users roles
          roles_out <- self$get_roles(invite$user_uid)

          new_session$is_admin <- invite$is_admin
          new_session$uid <- invite$user_uid
          new_session$roles <- roles_out

          # update the last sign in time
          DBI::dbExecute(
            self$conn,
            "UPDATE polished.app_users SET last_sign_in_at=$1 WHERE user_uid=$2 AND app_name=$3",
            params = list(
              tychobratools::time_now_utc(),
              invite$user_uid,
              self$app_name
            )
          )
        }, error = function(e) {

          print(e)
          new_session <<- NULL
        })


        # geneate a session token
        if (!is.null(new_session)) {

          new_session$token <- token

          private$add(new_session)
        }
      }

      return(new_session)
    },
    get_invite_by_email = function(email) {

      invite <- NULL
      DBI::dbWithTransaction(self$conn, {

        user_db <- DBI::dbGetQuery(
          #conn,
          self$conn,
          "SELECT * FROM polished.users WHERE email=$1",
          params = list(
            email
          )
        )


        if (nrow(user_db) != 1) {
          stop('unable to find users in "users" table')
        }

        invite <- self$get_invite_by_uid(user_db$uid)

        if (nrow(invite) != 1) {
          stop(sprintf('user "%s" is not authoized to access "%s"', email, self$app_name))
        }
      })

      return(invite)
    },
    get_invite_by_uid = function(user_uid) {

      if (private$authorization_level == "app") {
        # authorization for this user is set at the Shiny app level, so only check this specific app
        # to see if the user is authorized
        out <- DBI::dbGetQuery(
          self$conn,
          "SELECT * FROM polished.app_users WHERE user_uid=$1 AND app_name=$2",
          params = list(
            user_uid,
            self$app_name
          )
        )
      } else if (private$authorization_level == "all") {
        # if user is authoized to access any apps, they can access this app.
        # e.g. used for apps_dashboards where we want all users that are allowed to access any app to
        # be able to access the dashboard.
        out <- DBI::dbGetQuery(
          self$conn,
          "SELECT * FROM polished.app_users WHERE user_uid=$1 LIMIT 1",
          params = list(
            user_uid
          )
        )
      }

    },
    # return a character vector of the user's roles
    get_roles = function(user_uid) {
      roles <- character(0)
      DBI::dbWithTransaction(self$conn, {


        role_names <- DBI::dbGetQuery(
          #conn,
          self$conn,
          "SELECT uid, name FROM polished.roles WHERE app_name=$1",
          params = list(
            self$app_name
          )
        )

        role_uids <- DBI::dbGetQuery(
          #conn,
          self$conn,
          "SELECT role_uid FROM polished.user_roles WHERE user_uid=$1 AND app_name=$2",
          params = list(
            user_uid,
            self$app_name
          )
        )$role_uid

        roles <- role_names %>%
          dplyr::filter(uid %in% role_uids) %>%
          dplyr::pull(name)
      })

      roles
    },
    find = function(token) {
      if (length(private$sessions) == 0) return(NULL)

      private$sessions[[token]]
    },
    remove = function(token) {
      if (length(private$sessions) == 0) invisible(self)

      private$sessions[[token]] <- NULL

      invisible(self)
    },
    list = function() {
      private$sessions
    },
    refresh_email_verification = function(token, firebase_uid) {

      url_out <- paste0(self$firebase_functions_url, "get_user")
      response <- httr::GET(
        url_out,
        query = list(
          uid = firebase_uid
          #token = firebase_token
        )
      )
      httr::warn_for_status(response)
      email_verified_text <- httr::content(response, "text")
      email_verified <- jsonlite::fromJSON(email_verified_text)

      private$sessions[[token]]$email_verified <- email_verified

      invisible(self)
    },
    log_session = function(token, user_uid) {

      tryCatch({
        DBI::dbExecute(
          #conn,
          self$conn,
          "INSERT INTO polished.sessions ( app_name, user_uid, token ) VALUES ( $1, $2, $3 )",
          params = list(
            self$app_name,
            user_uid,
            token
          )
        )
      }, error = function(e) {
        print(e)

      })

    },
    set_signed_in_as = function(token, signed_in_as) {

      private$sessions[[token]]$signed_in_as <- signed_in_as

      invisible(self)
    },
    clear_signed_in_as = function(token) {

      if (!is.null(private$sessions[[token]]$signed_in_as)) {
        private$sessions[[token]]$signed_in_as <- NULL
      }

      invisible(self)
    }
  ),
  private = list(
    add = function(session) {
      private$sessions[[session$token]] <- session
      invisible(self)
    },
    sessions = vector("list", length = 0),
    authorization_level = "app" # or "all"
  )

)

.global_sessions <- Sessions$new()
