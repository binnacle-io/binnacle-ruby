module Binnacle
  class Configuration

    DEFAULT_IGNORED_EXCEPTIONS = [
      'ActiveRecord::RecordNotFound',
      'ActionController::RoutingError',
      'ActionController::InvalidAuthenticityToken',
      'CGI::Session::CookieStore::TamperedWithCookie',
      'ActionController::UnknownHttpMethod',
      'ActionController::UnknownAction',
      'AbstractController::ActionNotFound',
      'Mongoid::Errors::DocumentNotFound',
      'ActionController::UnknownFormat',
      'Sinatra::NotFound'
    ].map(&:freeze).freeze

    # The Binnacle Endpoint URL (BINNACLE_URL)
    attr_accessor :url

    # The application logger Binnacle Context (BINNACLE_APP_LOG_CTX)
    attr_accessor :logging_ctx

    # The application error Binnacle Context (BINNACLE_APP_ERR_CTX)
    attr_accessor :error_ctx

    # An approved publisher API key for the App (BINNACLE_API_KEY)
    attr_accessor :api_key

    # The API secret for the given API key (BINNACLE_API_SECRET)
    attr_accessor :api_secret

    # Whether to redirect rails logging to Binnacle (BINNACLE_RAILS_LOG)
    attr_accessor :intercept_rails_logging

    # Whether to report exceptions to Binnacle (BINNACLE_REPORT_EXCEPTIONS)
    attr_accessor :report_exceptions

    # Exceptions that do not get reported to Binnacle (BINNACLE_IGNORED_EXCEPTIONS)
    attr_accessor :ignored_exceptions

    # Whether to skip reporting exceptions where the headers['X-Cascade'] is set
    # to 'pass'. In Rails typically it means route was not found (404 error).
    attr_accessor :ignore_cascade_pass

    def initialize
      self.url         ||= ENV['BINNACLE_URL']
      self.logging_ctx ||= ENV['BINNACLE_APP_LOG_CTX']
      self.error_ctx   ||= ENV['BINNACLE_APP_ERR_CTX']
      self.api_key     ||= ENV['BINNACLE_API_KEY']
      self.api_secret  ||= ENV['BINNACLE_API_SECRET']
      self.intercept_rails_logging = ENV['BINNACLE_RAILS_LOG'] ? ENV['BINNACLE_RAILS_LOG'].downcase == 'true' : false
      self.report_exceptions = ENV['BINNACLE_REPORT_EXCEPTIONS'] ? ENV['BINNACLE_REPORT_EXCEPTIONS'].downcase == 'true' : false
      self.ignored_exceptions ||= ENV['BINNACLE_IGNORED_EXCEPTIONS'] ? DEFAULT_IGNORED_EXCEPTIONS + ENV['BINNACLE_IGNORED_EXCEPTIONS'].split(',') : DEFAULT_IGNORED_EXCEPTIONS
      self.ignore_cascade_pass     ||= true
    end

    def ready?
      self.url && self.api_key && self.api_secret
    end

    def can_setup_logger?
      self.intercept_rails_logging && self.logging_ctx
    end

    def trap?
      self.report_exceptions && self.error_ctx
    end

    def ignore_cascade_pass?
      self.ignore_cascade_pass
    end

    def to_s
      [ :url,
        :logging_ctx,
        :error_ctx,
        :api_key,
        :api_secret,
        :intercept_rails_logging,
        :report_exceptions
      ].map { |m| "#{m}: #{self.send(m)}" }.join(', ')
    end
  end
end
