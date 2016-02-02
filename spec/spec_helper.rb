ENV['BINNACLE_RB_ENVIRONMENT'] ||= 'test'
require 'codeclimate-test-reporter'
CodeClimate::TestReporter.start

require 'webmock/rspec'
require 'httpclient'
require 'excon'
require 'typhoeus'
require 'ethon'
require 'patron'
require 'http'
require 'vcr'
require 'binnacle'
require 'rspec/collection_matchers'
require 'rspec/wait'
require 'rack'
require 'logger'

require 'adapters/http_base_adapter'
Dir["#{File.dirname(__FILE__)}/adapters/*.rb"].each { |f| require f }
Dir["./spec/support/**/*.rb"].each { |f| require f }

# Start a local rack server to serve up test pages.
if ENV['SERVE_TEST_ASSETS'] == 'true'
  @server_thread = Thread.new do
    Rack::Handler::Thin.run HttpLogger::Test::Server.new, :Port => 9292
  end
  sleep(3) # wait a moment for the server to be booted
end

VCR.configure do |c|
  c.cassette_library_dir = 'spec/vcr'
  c.hook_into :webmock
  c.ignore_localhost = false
  c.ignore_hosts 'codeclimate.com'
  c.allow_http_connections_when_no_cassette = false
end

RSpec.configure do |config|
  config.around(:each, :vcr) do |example|
    name = example.metadata[:full_description].gsub(/\A(\S*)([\.])/, '\1 ').split(/\s+/, 2).join("/").underscore.gsub(/[^\w\/]+/, "_")
    options = example.metadata.slice(:record, :match_requests_on).except(:example_group)
    VCR.use_cassette(name, options) { example.call }
  end

  config.expect_with :rspec do |expectations|
    expectations.include_chain_clauses_in_custom_matcher_descriptions = true
  end

  config.mock_with :rspec do |mocks|
    mocks.verify_partial_doubles = true
  end
end

# Some Monkey Patching since we're not in Rails

class String
  def underscore
    return self.downcase if self =~ /^[A-Z]+$/
    self.gsub(/([A-Z]+)(?=[A-Z][a-z]?)|\B[A-Z]/, '_\&') =~ /_*(.*)/
    return $+.downcase
  end
end

class Hash
  def except(*keys)
    dup.except!(*keys)
  end

  # Replaces the hash without the given keys.
  def except!(*keys)
    keys.each { |key| delete(key) }
    self
  end

  def slice(*keys)
    keys.map! { |key| convert_key(key) } if respond_to?(:convert_key, true)
    keys.each_with_object(self.class.new) { |k, hash| hash[k] = self[k] if has_key?(k) }
  end
end



class Logger
  def pause
    @_logdev, @logdev = @logdev, nil
  end

  def continue
    @logdev = @_logdev
  end
end

class TestLogger < Logger
  def initialize
    @strio = StringIO.new
    super(@strio)
  end

  def messages
    @strio.string
  end
end

def reset_env
 [ 'BINNACLE_ENDPOINT',
   'BINNACLE_PORT',
   'BINNACLE_APP_LOG_CTX',
   'BINNACLE_APP_ERR_CTX',
   'BINNACLE_API_KEY',
   'BINNACLE_API_SECRET',
   'BINNACLE_RAILS_LOG',
   'BINNACLE_REPORT_EXCEPTIONS',
   'BINNACLE_IGNORED_EXCEPTIONS',
   'BINNACLE_RAILS_LOG_ASYNCH',
   'BINNACLE_ENCRYPTED' ].each { |key| ENV[key] = nil }
end
