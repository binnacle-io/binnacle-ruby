require 'rails/generators'
require 'yaml'

class BinnacleGenerator < Rails::Generators::Base
  source_root File.expand_path('../templates', __FILE__)

  gem "binnacle"

  desc "Generates the Binnacle Initializer (config/initializers/binnacle.rb)"

  def create_initializer_file

    initializer "binnacle.rb" do
      YAML::load(<<-EOM)
      |
      # #{'=' * 78}
      # Binnacle Configuration
      # #{'=' * 78}
      # Available parameters (preferably configure via ENV):
      # #{'=' * 78}
      # - url:         The Binnacle Endpoint URL (BINNACLE_URL)
      # - logging_channel: The application logger Binnacle Channel (BINNACLE_APP_LOG_CHANNEL)
      # - error_channel:   The application error Binnacle Channel (BINNACLE_APP_ERR_CHANNEL)
      # - api_key:     An approved publisher API key for the App (BINNACLE_API_KEY)
      # - api_secret:  The API secret for the given API key (BINNACLE_API_SECRET)
      # - intercept_rails_logging: Redirect rails logging to logging_channel (BINNACLE_RAILS_LOG)
      # - report_exceptions: Trap exceptions are log them to error_channel (BINNACLE_REPORT_EXCEPTIONS)
      # #{'=' * 78}
      Binnacle.configure do |config|
        config.intercept_rails_logging = true
        config.report_exceptions = true
      end
      EOM
    end
  end
end
