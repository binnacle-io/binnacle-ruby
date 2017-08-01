# coding: utf-8
lib = File.expand_path('../lib', __FILE__)
$LOAD_PATH.unshift(lib) unless $LOAD_PATH.include?(lib)
require 'binnacle/version'

Gem::Specification.new do |spec|
  spec.name          = "binnacle"
  spec.version       = Binnacle::VERSION
  spec.authors       = ["Brian Sam-Bodden"]
  spec.email         = ["brian@binnacle.com"]
  spec.summary       = %q{ Ruby client for the Binnacle API }
  spec.description   = %q{ Ruby Client for the RESTful Multi-channel Push Service Binnacle. See http://binnacle.io }
  spec.homepage      = "http://binnacle.io/api"
  spec.license       = "MIT"

  spec.files         = `git ls-files -z`.split("\x0")
  spec.executables   = spec.files.grep(%r{^bin/}) { |f| File.basename(f) }
  spec.test_files    = spec.files.grep(%r{^(test|spec|features)/})
  spec.require_paths = ["lib"]

  spec.add_runtime_dependency 'httpclient', '~> 2.8', '>= 2.8.0'
  spec.add_runtime_dependency 'faraday', '~> 0.11'
  spec.add_runtime_dependency 'faye-websocket', '~> 0.10', '>= 0.10.4'
  spec.add_runtime_dependency 'trollop', '~> 2.1', '>= 2.1.2'
  spec.add_runtime_dependency 'rack-timeout', '~> 0.4', '>= 0.4.2'
  spec.add_runtime_dependency 'addressable', '~> 2.5'
  spec.add_runtime_dependency 'colorize', '~> 0.8.1'

  spec.add_development_dependency 'bundler', '~> 1.10'
  spec.add_development_dependency 'rake', '~> 10.5'
  spec.add_development_dependency 'rspec', '~> 3.5', '>= 3.2.0'
  spec.add_development_dependency 'rspec-collection_matchers', '~> 1.1', '>= 1.1.2'
  spec.add_development_dependency 'rspec-wait', '~> 0.0.9'
  spec.add_development_dependency 'codeclimate-test-reporter', '~> 1.0', '>= 1.0.7'
  spec.add_development_dependency 'simplecov', '~> 0.14'
  spec.add_development_dependency 'vcr', '~> 3.0'
  spec.add_development_dependency 'webmock', '~> 2.3'
  spec.add_development_dependency 'fivemat', '~> 1.3', '>= 1.3.2'
  spec.add_development_dependency 'rack', '~> 2.0'

  # For outgoing HTTP logging testing
  spec.add_development_dependency 'httparty', '~> 0.14'
  spec.add_development_dependency 'excon', '~> 0.55'
  spec.add_development_dependency 'typhoeus', '~> 1.1'
  spec.add_development_dependency 'ethon', '~> 0.10'
  spec.add_development_dependency 'patron', '~> 0.8'
  spec.add_development_dependency 'http', '~> 2.2'
  spec.add_development_dependency 'thin', '~> 1.7'
end
