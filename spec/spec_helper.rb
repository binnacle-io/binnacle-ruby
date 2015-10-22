require 'codeclimate-test-reporter'
CodeClimate::TestReporter.start

require 'binnacle'
require 'vcr'
require 'webmock/rspec'
require 'rspec/collection_matchers'
require 'rack'

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
